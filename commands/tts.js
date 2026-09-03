const googleTTS = require('google-tts-api');

module.exports = {
  name: 'tts',
  aliases: ['.tts', '.say'],
  description: 'Convert text to a WhatsApp voice note.',
  async execute({ sock, msg, jid, textTrim }) {
    const args = (textTrim || '').replace(/^\.(?:tts|say)\b/i, '').trim();
    if (!args) {
      return sock.sendMessage(jid, { text: '❌ Please provide text! Example: `.tts Hello everyone`' });
    }

    await sock.sendMessage(jid, { react: { text: '🗣️', key: msg.key } });

    try {
      const url = googleTTS.getAudioUrl(args, {
        lang: 'en',
        slow: false,
        host: 'https://translate.google.com'
      });

      return sock.sendMessage(jid, {
        audio: { url },
        mimetype: 'audio/mpeg',
        ptt: true
      }, { quoted: msg });
    } catch (error) {
      console.error('tts: failed to generate voice note:', error);
      return sock.sendMessage(jid, { text: '❌ System voice core failed.' });
    }
  }
};