const fs = require('fs');
const path = require('path');

function normalizeJid(value) {
  if (!value) return null;
  return value.includes('@') ? value : `${value}@s.whatsapp.net`;
}

function getMediaMessage(quoted) {
  if (quoted.imageMessage) return { message: quoted.imageMessage, type: 'image' };
  if (quoted.videoMessage) return { message: quoted.videoMessage, type: 'video' };
  if (quoted.documentMessage) return { message: quoted.documentMessage, type: 'document' };
  if (quoted.audioMessage) return { message: quoted.audioMessage, type: 'audio' };
  for (const wrapper of ['viewOnceMessage', 'viewOnceMessageV2', 'ephemeralMessage']) {
    if (quoted[wrapper] && quoted[wrapper].message) {
      const media = getMediaMessage(quoted[wrapper].message);
      if (media) return media;
    }
  }
  return null;
}

module.exports = {
  name: 'mevv',
  aliases: ['.mevv'],
  description: 'Recover quoted media or documents and send them privately to the configured owner.',
  async execute({ sock, msg, jid, helpers }) {
    try {
      const { downloadContentFromMessage, streamToBuffer } = helpers;
      let config = {};
      try {
        config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'config.json'), 'utf8')) || {};
      } catch (error) {
        console.error('mevv: unable to read data/config.json:', error.message);
      }
      const ownerId = normalizeJid(config.ownerJid || config.owner || config.ownerNumber);
      if (!ownerId || ownerId.endsWith('@g.us')) {
        console.error('mevv: no valid owner configured in data/config.json. Set owner to a WhatsApp JID.');
      }
      const sendPrivateNotice = async (text) => {
        if (ownerId && !ownerId.endsWith('@g.us')) await sock.sendMessage(ownerId, { text });
      };
      const quoted = msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo && msg.message.extendedTextMessage.contextInfo.quotedMessage;
      if (!quoted) return await sendPrivateNotice('Reply to an image, video, or document with .mevv.');

      const media = getMediaMessage(quoted);

      if (!media) return await sendPrivateNotice('Quoted message does not contain recoverable media or a document.');
      const stream = await downloadContentFromMessage(media.message, media.type);
      const buf = await streamToBuffer(stream);
      if (!buf || buf.length === 0) return await sendPrivateNotice('Failed to retrieve media.');

      if (!ownerId || ownerId.endsWith('@g.us')) return await sendPrivateNotice('mevv is not configured: set owner in data/config.json.');

      if (media.type === 'image') {
        await sock.sendMessage(ownerId, { image: buf, caption: 'Recovered media (private)' });
      } else if (media.type === 'video') {
        await sock.sendMessage(ownerId, { video: buf, caption: 'Recovered media (private)' });
      } else if (media.type === 'document') {
        await sock.sendMessage(ownerId, {
          document: buf,
          fileName: media.message.fileName || 'recovered-file',
          mimetype: media.message.mimetype || 'application/octet-stream',
          caption: 'Recovered document (private)'
        });
      } else {
        await sock.sendMessage(ownerId, { audio: buf, mimetype: media.message.mimetype || 'audio/mp4' });
      }

      // Best-effort removal of the command from the original chat.
      if (msg && msg.key && msg.key.id && jid) {
        try {
          await sock.sendMessage(jid, { delete: msg.key });
        } catch (error) {
          console.error('mevv: unable to delete command message:', error.message);
        }
      }

    } catch (e) {
      console.error('mevv command error:', e);
    }
  }
};
