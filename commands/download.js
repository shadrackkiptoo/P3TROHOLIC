module.exports = {
  name: 'download',
  aliases: ['.download', '.dl', '.video'],
  description: 'Download videos from social networks.',
  async execute({ sock, msg, jid, textTrim }) {
    const urlLink = (textTrim || '').replace(/^\.(?:download|dl|video)\b/i, '').trim().split(/\s+/)[0];
    if (!urlLink || !URL.canParse(urlLink)) {
      return sock.sendMessage(jid, { text: '❌ Please provide a valid URL link!' });
    }

    await sock.sendMessage(jid, { react: { text: '⏳', key: msg.key } });

    try {
      const response = await fetch('https://api.cobalt.tools/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ url: urlLink, downloadMode: 'auto', videoQuality: '720' })
      });
      if (!response.ok) throw new Error(`Downloader returned HTTP ${response.status}`);

      const data = await response.json();
      if (!data.url || !['redirect', 'tunnel', 'stream'].includes(data.status)) throw new Error('No downloadable media URL');

      return sock.sendMessage(jid, {
        video: { url: data.url },
        caption: '📥 *Downloaded successfully!*'
      }, { quoted: msg });
    } catch (error) {
      console.error('download: failed to process URL:', error);
      return sock.sendMessage(jid, { text: '❌ Failed to process video link. Ensure the profile is public.' });
    }
  }
};