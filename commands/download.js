const fs = require('fs');
const os = require('os');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');
const YTDlpWrap = require('yt-dlp-wrap').default;

let ytDlpWrap;

async function getTikTokUrl(urlLink) {
  const response = await fetch('https://www.tikwm.com/api/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ url: urlLink })
  });
  if (!response.ok) throw new Error(`TikTok API returned HTTP ${response.status}`);
  const data = await response.json();
  if (data.code !== 0 || !data.data?.play) throw new Error(data.msg || 'TikTok video was not found');
  return data.data.play;
}

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

    let outputPath;
    try {
      const parsedUrl = new URL(urlLink);
      let mediaUrl;
      if (parsedUrl.hostname === 'tiktok.com' || parsedUrl.hostname.endsWith('.tiktok.com')) {
        mediaUrl = await getTikTokUrl(urlLink);
        return sock.sendMessage(jid, {
          video: { url: mediaUrl },
          caption: '📥 *Downloaded successfully!*'
        }, { quoted: msg });
      } else {
        const downloader = await getDownloader();
        outputPath = path.join(os.tmpdir(), `dotvv-${Date.now()}.mp4`);
        await downloader.execPromise([
          urlLink,
          '--no-playlist',
          '-f', 'bv*[height<=480]+ba/b[height<=480]',
          '--merge-output-format', 'mp4',
          '--ffmpeg-location', ffmpegPath,
          '-o', outputPath,
          '--no-warnings'
        ]);
        if (!fs.existsSync(outputPath)) throw new Error('Downloader did not create a video file');
        const mediaBuffer = fs.readFileSync(outputPath);
        fs.rmSync(outputPath, { force: true });
        return sock.sendMessage(jid, {
          video: mediaBuffer,
          caption: '📥 *Downloaded successfully!*'
        }, { quoted: msg });
      }
    } catch (error) {
      if (outputPath) fs.rmSync(outputPath, { force: true });
      console.error('download: failed to process URL:', error);
      return sock.sendMessage(jid, { text: '❌ Could not download this public video. The link may be unsupported or may not point directly to a video.' });
    }
  }
};