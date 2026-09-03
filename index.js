const fs = require('fs');
const path = require('path');
const toWebp = require('./sticker');
const util = require('util');
const qrcode = require('qrcode-terminal');

// Minimal web server so hosting platforms (Render, Heroku, etc.) can keep the process alive.
// Render requires a bound port; Uptime monitors can ping this URL to prevent sleeping.
const http = require('http');
const WEB_PORT = process.env.PORT || 3000;
try {
  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  server.listen(WEB_PORT, () => console.log(`Webserver listening on port ${WEB_PORT}`));
} catch (e) {
  console.error('Failed to start webserver:', e);
}

// simple file logger: append logs to `p3troholic.log` and still print to console
const logStream = fs.createWriteStream('./p3troholic.log', { flags: 'a' });
const _consoleLog = console.log.bind(console);
const _consoleError = console.error.bind(console);
function serializeArg(a) {
  if (a instanceof Error) return a.stack || a.toString();
  if (typeof a === 'object') {
    try { return JSON.stringify(a); } catch (e) { return String(a); }
  }
  return String(a);
}
function writeLog(level, args) {
  const line = `[${new Date().toISOString()}] ${level} ${args.map(serializeArg).join(' ')}\n`;
  logStream.write(line);
}
console.log = (...args) => { writeLog('INFO', args); _consoleLog(...args); };
console.error = (...args) => { writeLog('ERROR', args); _consoleError(...args); };

process.on('exit', () => logStream.end());
process.on('SIGINT', () => { logStream.end(); process.exit(); });

let reconnectAttempts = 0;
let isStarting = false;
const MAX_RETRIES = 5;
let downloadContentFromMessage;


async function start() {
  if (isStarting) return;
  isStarting = true;
  const {
    default: makeWASocket,
    useMultiFileAuthState,
    downloadContentFromMessage: downloadContent,
    fetchLatestBaileysVersion
  } = await import('@whiskeysockets/baileys');
  downloadContentFromMessage = downloadContent;
  const { version } = await fetchLatestBaileysVersion();
  const defaultAuthDir = path.join(__dirname, 'auth_info');
  let authDir = process.env.AUTH_DIR || defaultAuthDir;
  if (authDir !== defaultAuthDir) {
    try {
      fs.mkdirSync(authDir, { recursive: true });
    } catch (e) {
      console.error(`AUTH_DIR is not writable: ${authDir}. Falling back to ${defaultAuthDir}.`);
      authDir = defaultAuthDir;
    }
  }
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const pairingNumber = (process.env.PAIRING_NUMBER || '').replace(/[^0-9]/g, '');

  const sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
    version
  });

  const sentMessageIds = new Set();
  const originalSendMessage = sock.sendMessage.bind(sock);
  sock.sendMessage = async (...args) => {
    const result = await originalSendMessage(...args);
    if (result && result.key && result.key.id) sentMessageIds.add(result.key.id);
    return result;
  };

  sock.ev.on('creds.update', saveCreds);

  if (!state.creds.registered && pairingNumber) {
    setTimeout(async () => {
      try {
        const pairingCode = await sock.requestPairingCode(pairingNumber);
        console.log(`================ PAIRING CODE: ${pairingCode} ================`);
        console.log('WhatsApp: Settings > Linked devices > Link a device > Link with phone number.');
      } catch (e) {
        console.error('Failed to request WhatsApp pairing code:', e);
      }
    }, 3000);
  }

  // Load command modules from the commands directory
  const commands = [];
  const commandsMap = {};
  const commandsDir = path.join(__dirname, 'commands');
  if (fs.existsSync(commandsDir)) {
    for (const file of fs.readdirSync(commandsDir)) {
      if (!file.endsWith('.js')) continue;
      try {
        const cmd = require(path.join(commandsDir, file));
        if (cmd && cmd.name) {
          commands.push(cmd);
          const base = cmd.name.replace(/^\./, '');
          commandsMap[base] = cmd;
          commandsMap['.' + base] = cmd;
          if (cmd.aliases && Array.isArray(cmd.aliases)) {
            for (const a of cmd.aliases) {
              const key = a.replace(/^\./, '');
              commandsMap[key] = cmd;
              commandsMap['.' + key] = cmd;
            }
          }
        }
      } catch (e) {
        console.error('Failed to load command', file, e);
      }
    }
  }

  // show QR and connection updates clearly
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    // verbose dump of the entire update object for debugging
    console.log('connection update full:', util.inspect(update, { depth: null }));
    // Some Baileys versions return a link/ref instead of a QR string.
    // Use any available QR string or link and print an ASCII QR in the terminal.
    const qrData = qr || update.ref || update.link || update.url || update.referral;
    if (qrData) {
      console.log('QR code / link (scan or open with WhatsApp Linked Devices):\n', qrData);
      try {
        qrcode.generate(qrData, { small: true }, (q) => console.log(q));
      } catch (e) {
        console.error('Failed to render QR in terminal:', e);
      }
    }
    if (connection) console.log('connection update:', connection);

    if (connection === 'open') {
      console.log('connection opened');
      reconnectAttempts = 0;
      isStarting = false;
      return;
    }

    if (connection === 'close') {
      console.log('connection closed', lastDisconnect && lastDisconnect.error ? lastDisconnect.error : lastDisconnect);
      const statusCode = lastDisconnect && lastDisconnect.error && lastDisconnect.error.output && lastDisconnect.error.output.statusCode;
      if (statusCode === 440) {
        isStarting = false;
        console.error('WhatsApp session conflict: another bot instance or linked device replaced this connection. Stop the other instance, then restart this service.');
        return;
      }
      // if there is a structured error, print its full payload
      if (lastDisconnect && lastDisconnect.error) {
        try {
          console.log('lastDisconnect.error full:', util.inspect(lastDisconnect.error, { depth: null }));
          if (lastDisconnect.error.output) console.log('lastDisconnect.error.output.payload:', util.inspect(lastDisconnect.error.output.payload, { depth: null }));
        } catch (e) {
          console.error('failed to dump lastDisconnect.error:', e);
        }
      }

      isStarting = false;
      reconnectAttempts++;
      if (reconnectAttempts <= MAX_RETRIES) {
        const delay = Math.min(30000, 1000 * Math.pow(2, reconnectAttempts)) + Math.floor(Math.random() * 1000);
        console.log(`reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RETRIES})`);
        setTimeout(() => start(), delay);
      } else {
        console.log('Max reconnect attempts reached — give up. Check network or try again later.');
      }
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    try {
      const messages = m.messages;
      const msg = messages[0];
      if (!msg || !msg.message) return;
      if (msg.key && msg.key.id && sentMessageIds.has(msg.key.id)) {
        sentMessageIds.delete(msg.key.id);
        return;
      }
      const jid = msg.key.remoteJid;

      // anti-delete has been removed; no message caching performed here.

      const text = msg.message.conversation || (msg.message.extendedTextMessage && msg.message.extendedTextMessage.text) || '';
      const textTrim = text && text.trim();

      // Remove non-admin link senders from groups before processing commands.
      if (jid && jid.endsWith('@g.us') && /(?:https?:\/\/|wa\.me\/)/i.test(text)) {
        const sender = msg.key.participant || msg.key.remoteJid;
        try {
          const metadata = await sock.groupMetadata(jid);
          const senderData = metadata.participants.find((participant) => participant.id === sender);
          const isAdmin = senderData?.admin === 'admin' || senderData?.admin === 'superadmin';
          if (!isAdmin) {
            await sock.sendMessage(jid, { delete: msg.key });
            await sock.sendMessage(jid, {
              text: `⚠️ *SECURITY WARNING:* @${sender.split('@')[0]} has been removed for sending links!`,
              mentions: [sender]
            });
            await sock.groupParticipantsUpdate(jid, [sender], 'remove');
            return;
          }
        } catch (error) {
          console.error('anti-link guard failed:', error);
        }
      }

      // auto-moderator: check filters for groups and warn
      try {
        if (jid && jid.endsWith('@g.us') && textTrim) {
          const filters = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'data', 'filters.json'), 'utf8') || '{}');
          const groupFilters = (filters.groups && filters.groups[jid]) || [];
          for (const word of groupFilters) {
            if (word && textTrim.toLowerCase().includes(word.toLowerCase())) {
              // warn and attempt to delete (best-effort)
              try {
                await sock.sendMessage(jid, { text: `Message contained banned word and was flagged: ${word}` });
                // attempt to delete the offending message (may require admin)
                await sock.sendMessage(jid, { delete: msg.key });
              } catch (e) {
                console.error('moderator: failed to delete or warn', e);
              }
              return; // stop processing commands for this message
            }
          }
        }
      } catch (e) { console.error('moderator check failed', e); }

      // determine command name: text command like .st or caption-based (image with caption starting with .)
      let cmdName = null;
      if (textTrim && textTrim.startsWith('.')) cmdName = textTrim.split(/\s+/)[0].replace(/^\./, '');
      // caption trigger
      if (!cmdName && msg.message.imageMessage && msg.message.imageMessage.caption && msg.message.imageMessage.caption.trim().startsWith('.')) {
        cmdName = msg.message.imageMessage.caption.trim().split(/\s+/)[0].replace(/^\./, '');
      }
      if (!cmdName) return;

      // find command in loaded commands
      const command = commandsMap[cmdName] || commandsMap['.' + cmdName] || null;
      if (!command) return;

      const contextInfo = msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo;
      if (contextInfo && contextInfo.quotedMessage && contextInfo.stanzaId) {
        try {
          await sock.sendMessage(jid, {
            react: {
              text: '🤖',
              key: {
                remoteJid: jid,
                fromMe: false,
                id: contextInfo.stanzaId,
                participant: contextInfo.participant
              }
            }
          });
        } catch (e) {
          console.error('Failed to react to quoted command message:', e);
        }
      }

      const quotedReply = contextInfo && contextInfo.quotedMessage && contextInfo.stanzaId
        ? {
          key: {
            remoteJid: jid,
            fromMe: false,
            id: contextInfo.stanzaId,
            participant: contextInfo.participant
          },
          message: contextInfo.quotedMessage
        }
        : null;
      const commandSock = Object.create(sock);
      commandSock.sendMessage = (to, content, options) => {
        const shouldQuote = quotedReply && to === jid && content && !content.react && !content.delete;
        const sendOptions = shouldQuote ? { ...(options || {}), quoted: quotedReply } : options;
        return sock.sendMessage(to, content, sendOptions);
      };

      const helpers = { downloadContentFromMessage, streamToBuffer, toWebp, commands };
      await command.execute({ sock: commandSock, msg, jid, helpers, textTrim });
    } catch (e) {
      console.error('Message handling error:', e);
    }
  });

  // anti-delete removed: no handler for message updates

  // Scheduler runner: check scheduled jobs every 15 seconds
  setInterval(async () => {
    try {
      const sfile = require('path').join(__dirname, 'data', 'schedule.json');
      let sd = { jobs: [] };
      try { sd = JSON.parse(fs.readFileSync(sfile, 'utf8') || '{}'); } catch (e) { sd = { jobs: [] }; }
      const now = Date.now();
      const remaining = [];
      for (const job of sd.jobs || []) {
        const when = Date.parse(job.when);
        if (!when) continue;
        if (when <= now) {
          try {
            await sock.sendMessage(job.jid || job.to || job.target || job.jid, { text: job.body });
          } catch (e) { console.error('scheduler failed to send', job, e); }
        } else {
          remaining.push(job);
        }
      }
      if (remaining.length !== (sd.jobs || []).length) fs.writeFileSync(sfile, JSON.stringify({ jobs: remaining }, null, 2));
    } catch (e) { console.error('scheduler error', e); }
  }, 15000);

  // Welcome feature removed — group join handler disabled.

  console.log('P3TROHOLIC bot started. Scan QR in terminal to authenticate.');
}

async function getImageBuffer(message) {
  if (message.message.imageMessage) {
    const stream = await downloadContentFromMessage(message.message.imageMessage, 'image');
    return await streamToBuffer(stream);
  }
  const quoted = message.message.extendedTextMessage && message.message.extendedTextMessage.contextInfo && message.message.extendedTextMessage.contextInfo.quotedMessage;
  if (quoted && quoted.imageMessage) {
    const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
    return await streamToBuffer(stream);
  }
  return null;
}

async function streamToBuffer(stream) {
  let buffer = Buffer.from([]);
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }
  return buffer;
}

start();
