module.exports = {
  name: 'st',
  aliases: ['.st'],
  description: 'Create sticker from image (caption .st or reply with .st)',
  async execute({ sock, msg, jid, helpers, textTrim }) {
    try {
      const { downloadContentFromMessage, streamToBuffer, toWebp } = helpers;

      // Case A: image with caption starting with .st
      if (msg.message.imageMessage && msg.message.imageMessage.caption && msg.message.imageMessage.caption.trim().startsWith('.st')) {
        const stream = await downloadContentFromMessage(msg.message.imageMessage, 'image');
        const buf = await streamToBuffer(stream);
        const webp = await toWebp(buf);
        await sock.sendMessage(jid, { sticker: webp });
        return;
      }

      // Case B: text command .st replying to an image
      const quoted = msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo && msg.message.extendedTextMessage.contextInfo.quotedMessage;
      if (quoted && quoted.imageMessage) {
        const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
        const buf = await streamToBuffer(stream);
        const webp = await toWebp(buf);
        await sock.sendMessage(jid, { sticker: webp });
        return;
      }

      await sock.sendMessage(jid, { text: 'No image found to convert. Send an image with caption .st or reply to an image with .st' });
    } catch (e) {
      console.error('st command error:', e);
      await sock.sendMessage(jid, { text: 'Failed to create sticker.' });
    }
  }
};
