module.exports = {
  name: 'mevv',
  aliases: ['.mevv'],
  description: 'Recover quoted image/video and send it privately to your DM (does not post in original chat).',
  async execute({ sock, msg, jid, helpers }) {
    try {
      const { downloadContentFromMessage, streamToBuffer } = helpers;
      const isGroupMessage = Boolean(jid && jid.endsWith('@g.us'));
      const ownerId = isGroupMessage
        ? (msg.key && (msg.key.participant || msg.key.participantAlt)) || null
        : (msg.key && (msg.key.remoteJid || msg.key.remoteJidAlt)) || null;
      const sendPrivateNotice = async (text) => {
        if (ownerId && !ownerId.endsWith('@g.us')) await sock.sendMessage(ownerId, { text });
      };
      const quoted = msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo && msg.message.extendedTextMessage.contextInfo.quotedMessage;
      if (!quoted) return await sendPrivateNotice('Reply to an image or video with .mevv to recover it privately to your DM.');

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

      if (!mediaMessage || !mediaType) return await sendPrivateNotice('Quoted message does not contain an image or video I can recover.');
      const stream = await downloadContentFromMessage(mediaMessage, mediaType);
      const buf = await streamToBuffer(stream);
      if (!buf || buf.length === 0) return await sendPrivateNotice('Failed to retrieve media.');

      if (!ownerId || ownerId.endsWith('@g.us')) {
        return;
      }

      // Send privately to the command sender's self-DM (do not post in the original chat).
      if (mediaType === 'image') await sock.sendMessage(ownerId, { image: buf, caption: 'Recovered media (private)' });
      else await sock.sendMessage(ownerId, { video: buf, caption: 'Recovered media (private)' });

    } catch (e) {
      console.error('mevv command error:', e);
    }
  }
};
