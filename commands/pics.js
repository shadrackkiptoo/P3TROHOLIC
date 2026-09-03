const cheerio = require('cheerio');

const pendingScans = new Map();
const MAX_IMAGES = 50;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function commandArgs(textTrim) {
  return (textTrim || '').replace(/^\.pics\b/i, '').trim();
}

function imageType(url, contentType) {
  const mime = (contentType || '').split(';')[0].toLowerCase();
  if (mime === 'image/png' || /\.png(?:$|[?#])/i.test(url)) return 'PNG';
  if (mime === 'image/jpeg' || /\.(?:jpe?g)(?:$|[?#])/i.test(url)) return 'JPG';
  if (mime === 'image/gif' || /\.gif(?:$|[?#])/i.test(url)) return 'GIF';
  if (mime === 'image/webp' || /\.webp(?:$|[?#])/i.test(url)) return 'WEBP';
  return 'OTHER';
}

async function scanPage(pageUrl) {
  const response = await fetch(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!response.ok) throw new Error(`Website returned HTTP ${response.status}`);
  const html = await response.text();
  const $ = cheerio.load(html);
  const urls = new Set();

  $('img[src], img[data-src], img[data-lazy-src], img[srcset]').each((_, element) => {
    const source = $(element).attr('src') || $(element).attr('data-src') || $(element).attr('data-lazy-src');
    const srcset = $(element).attr('srcset');
    const candidate = srcset ? srcset.split(',').pop().trim().split(/\s+/)[0] : source;
    if (candidate) {
      try { urls.add(new URL(candidate, pageUrl).href); } catch (error) { /* Ignore malformed image URLs. */ }
    }
  });

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    if (href && /\.(?:png|jpe?g|gif|webp)(?:$|[?#])/i.test(href)) {
      try { urls.add(new URL(href, pageUrl).href); } catch (error) { /* Ignore malformed image URLs. */ }
    }
  });

  return [...urls].slice(0, MAX_IMAGES);
}

async function downloadImage(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!response.ok) throw new Error(`Image returned HTTP ${response.status}`);
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_IMAGE_BYTES) throw new Error('Image is too large');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error('Invalid image size');
  return { buffer, type: imageType(url, response.headers.get('content-type')) };
}

function countTypes(urls) {
  const counts = { PNG: 0, JPG: 0, GIF: 0, WEBP: 0, OTHER: 0 };
  for (const url of urls) counts[imageType(url)]++;
  return counts;
}

module.exports = {
  name: 'pics',
  aliases: ['.pics', '.images'],
  description: 'Count, confirm, and download images from a public webpage.',
  async execute({ sock, msg, jid, textTrim }) {
    const args = commandArgs(textTrim);
    const decision = args.toLowerCase();

    if (decision === 'yes' || decision === 'no' || decision === 'cancel') {
      const scan = pendingScans.get(jid);
      if (!scan) return sock.sendMessage(jid, { text: '❌ There is no pending image scan.' });
      pendingScans.delete(jid);
      if (decision !== 'yes') return sock.sendMessage(jid, { text: '❌ Image download cancelled.' });

      await sock.sendMessage(jid, { text: `⬇️ Downloading ${scan.urls.length} images...` });
      const groups = new Map();
      let failed = 0;
      for (const url of scan.urls) {
        try {
          const image = await downloadImage(url);
          if (!groups.has(image.type)) groups.set(image.type, []);
          groups.get(image.type).push(image.buffer);
        } catch (error) {
          failed++;
          console.error('pics: failed image:', url, error.message);
        }
      }

      let sent = 0;
      for (const [type, images] of groups) {
        for (const buffer of images) {
          await sock.sendMessage(jid, { image: buffer, caption: `🖼️ ${type} image` }, { quoted: msg });
          sent++;
        }
      }
      return sock.sendMessage(jid, { text: `✅ Sent ${sent}/${scan.urls.length} images${failed ? ` (${failed} failed)` : ''}.` });
    }

    if (!args || !URL.canParse(args.split(/\s+/)[0])) {
      return sock.sendMessage(jid, { text: '❌ Usage: `.pics https://example.com` then reply `.pics yes` to download.' });
    }

    const pageUrl = args.split(/\s+/)[0];
    try {
      const urls = await scanPage(pageUrl);
      if (!urls.length) return sock.sendMessage(jid, { text: '❌ No supported images found on that webpage.' });
      pendingScans.set(jid, { urls });
      const counts = countTypes(urls);
      const summary = Object.entries(counts).filter(([, count]) => count).map(([type, count]) => `${type}: ${count}`).join('\n');
      return sock.sendMessage(jid, {
        text: `🔎 Found ${urls.length} image(s)\n\n${summary}\n\nReply ".pics yes" to download all, or ".pics no" to cancel.`
      }, { quoted: msg });
    } catch (error) {
      console.error('pics: scan failed:', error);
      return sock.sendMessage(jid, { text: '❌ Could not scan that public webpage.' });
    }
  }
};