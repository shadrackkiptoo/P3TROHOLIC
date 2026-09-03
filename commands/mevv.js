const fs = require('fs');
const path = require('path');

function normalizeJid(input) {
  if (!input) return null;
  return input.includes('@') ? input : `${input}@s.whatsapp.net`;
}

module.exports = {
  name: 'mevv',
  aliases: ['.mevv'],
  description: 'Recover quoted image/video and send it privately to your DM (does not post in original chat).',
  async execute({ sock, msg, jid, helpers }) {
    try {
      const { downloadContentFromMessage, streamToBuffer } = helpers;
      const quoted = msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo && msg.message.extendedTextMessage.contextInfo.quotedMessage;
      if (!quoted) return await sock.sendMessage(jid, { text: 'Reply to an image or video with .mevv to recover it privately to your DM.' });

      // determine the sender's personal JID to DM (fallback)
      const senderJid = (msg.key && msg.key.participant) ? msg.key.participant : (msg.key && msg.key.remoteJid) || null;

      let mediaMessage = null;
      let mediaType = null;
      if (quoted.imageMessage) { mediaMessage = quoted.imageMessage; mediaType = 'image'; }
      else if (quoted.videoMessage) { mediaMessage = quoted.videoMessage; mediaType = 'video'; }
      else if (quoted.viewOnceMessage) {
        const v = quoted.viewOnceMessage;
        if (v.message) {
          if (v.message.imageMessage) { mediaMessage = v.message.imageMessage; mediaType = 'image'; }
          else if (v.message.videoMessage) { mediaMessage = v.message.videoMessage; mediaType = 'video'; }
        } else if (v.imageMessage) { mediaMessage = v.imageMessage; mediaType = 'image'; }
        else if (v.videoMessage) { mediaMessage = v.videoMessage; mediaType = 'video'; }
      }

      if (!mediaMessage || !mediaType) return await sock.sendMessage(jid, { text: 'Quoted message does not contain an image or video I can recover.' });
      const stream = await downloadContentFromMessage(mediaMessage, mediaType);
      const buf = await streamToBuffer(stream);
      if (!buf || buf.length === 0) return await sock.sendMessage(jid, { text: 'Failed to retrieve media.' });

      // Prefer sending to configured owner JID (your self-DM). Look for data/config.json -> ownerJid
      let targetJid = null;
      try {
        const cfgPath = path.join(__dirname, '..', 'data', 'config.json');
        if (fs.existsSync(cfgPath)) {
          const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) || {};
          if (cfg.ownerJid || cfg.owner || cfg.ownerNumber) targetJid = normalizeJid(cfg.ownerJid || cfg.owner || cfg.ownerNumber);
        }
      } catch (err) {
        // ignore config read errors and fall back
      }

      if (!targetJid) {
        // fallback to sending to the command sender's personal JID
        targetJid = senderJid;
      }

      if (!targetJid) return await sock.sendMessage(jid, { text: 'Cannot determine destination JID to send recovered media. Set `ownerJid` in data/config.json to your self-DM (e.g. 123456789@s.whatsapp.net).' });

      // send privately to the configured owner/self-DM (do not post in the original chat)
      if (mediaType === 'image') await sock.sendMessage(targetJid, { image: buf, caption: 'Recovered media (private)' });
      else await sock.sendMessage(targetJid, { video: buf, caption: 'Recovered media (private)' });

      // best-effort: delete the .mevv command message so it disappears from the original chat
      try {
        if (msg && msg.key && msg.key.id) {
          await sock.sendMessage(jid, { delete: { remoteJid: jid, id: msg.key.id, participant: msg.key.participant } });
        }
      } catch (err) {
        // ignore deletion errors (permissions, unsupported by server, etc.)
      }
    } catch (e) {
      console.error('mevv command error:', e);
      await sock.sendMessage(jid, { text: 'Error while trying to recover media.' });
    }
  }
};
