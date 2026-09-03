module.exports = {
  name: 'vv',
  aliases: ['.vv'],
  description: 'Re-send the replied-to image or video so it can be viewed',
  async execute({ sock, msg, jid, helpers }) {
    try {
      const { downloadContentFromMessage, streamToBuffer } = helpers;
      const quoted = msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo && msg.message.extendedTextMessage.contextInfo.quotedMessage;
      if (!quoted) return await sock.sendMessage(jid, { text: 'Reply to an image or video with .vv to view it.' });

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

      if (!mediaMessage || !mediaType) return await sock.sendMessage(jid, { text: 'Quoted message does not contain an image or video I can re-send.' });
      const stream = await downloadContentFromMessage(mediaMessage, mediaType);
      const buf = await streamToBuffer(stream);
      if (!buf || buf.length === 0) return await sock.sendMessage(jid, { text: 'Failed to retrieve media.' });
      if (mediaType === 'image') await sock.sendMessage(jid, { image: buf });
      else await sock.sendMessage(jid, { video: buf });
    } catch (e) {
      console.error('vv command error:', e);
      await sock.sendMessage(jid, { text: 'Error while trying to show the media. It may be view-once or unavailable.' });
    }
  }
};
