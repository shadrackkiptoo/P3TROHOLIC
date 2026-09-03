const fs = require('fs');
const os = require('os');
const path = require('path');
const YTDlpWrap = require('yt-dlp-wrap').default;

let ytDlpWrap;

async function getDownloader() {
  if (ytDlpWrap) return ytDlpWrap;

  const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
  const binaryPath = path.join(os.tmpdir(), binaryName);
  if (!fs.existsSync(binaryPath)) {
    await YTDlpWrap.downloadFromGithub(binaryPath);
  }
  ytDlpWrap = new YTDlpWrap(binaryPath);
  return ytDlpWrap;
}

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
      const downloader = await getDownloader();
      const mediaUrl = (await downloader.execPromise([
        urlLink,
        '--no-playlist',
        '-f',
        'best[ext=mp4]/best',
        '--get-url',
        '--no-warnings'
      ])).trim().split(/\r?\n/)[0];
      if (!mediaUrl || !URL.canParse(mediaUrl)) throw new Error('No downloadable media URL');

      return sock.sendMessage(jid, {
        video: { url: mediaUrl },
        caption: '📥 *Downloaded successfully!*'
      }, { quoted: msg });
    } catch (error) {
      console.error('download: failed to process URL:', error);
      return sock.sendMessage(jid, { text: '❌ Failed to process video link. Ensure the profile is public.' });
    }
  }
};