const fs = require('fs');
const path = require('path');

async function getFetch() {
  if (typeof fetch === 'function') return fetch.bind(global);
  try {
    // dynamic require in case node-fetch isn't installed globally
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nf = require('node-fetch');
    return nf;
  } catch (e) {
    throw new Error('No fetch available. Install node-fetch or use Node 18+ with global fetch.');
  }
}

function extractQuotedText(msg) {
  // Handles multiple quoted message shapes
  const ext = msg.message && msg.message.extendedTextMessage;
  const ctx = ext && ext.contextInfo;
  if (!ctx || !ctx.quotedMessage) return null;
  const q = ctx.quotedMessage;
  // common places for text
  return q.conversation || (q.extendedTextMessage && q.extendedTextMessage.text) || (q.imageMessage && q.imageMessage.caption) || (q.videoMessage && q.videoMessage.caption) || null;
}

module.exports = {
  name: '.tr',
  description: 'Translate quoted text using configured API (set TRANSLATE_API_URL/KEY in env).',
  async execute({ sock, msg, jid }) {
    const commandText = (msg.message && (msg.message.conversation || (msg.message.extendedTextMessage && msg.message.extendedTextMessage.text))) || '';
    const parts = commandText.trim().split(/\s+/);
    const lang = parts[1];

    const quoted = extractQuotedText(msg);
    if (!quoted) return sock.sendMessage(jid, { text: 'Reply to a message with `.tr <lang>` to translate.' });

    // allow configuration via env vars or data/config.json as a fallback
    const cfgPath = path.join(__dirname, '..', 'data', 'config.json');
    let cfg = {};
    try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8') || '{}'); } catch (e) { cfg = {}; }
    const apiKey = process.env.TRANSLATE_API_KEY || process.env.TRANSLATE_API || cfg.translate_api_key || cfg.translateApiKey;
    const apiUrl = process.env.TRANSLATE_API_URL || cfg.translate_api_url || cfg.translateApiUrl || null;
    if (!apiUrl) return sock.sendMessage(jid, { text: 'Translate API URL not configured. Set TRANSLATE_API_URL or add `translateApiUrl` to data/config.json.' });

    try {
      // If user only typed `.tr` return list of supported target languages.
      if (!lang) {
        try {
          const fetch = await getFetch();
          const languagesUrl = (() => {
            // build a probable languages endpoint from the configured apiUrl
            try {
              const u = new URL(apiUrl);
              // if path contains 'translate', replace with 'languages'
              if (/translate/i.test(u.pathname)) {
                u.pathname = u.pathname.replace(/translate/i, 'languages');
              } else {
                u.pathname = (u.pathname.replace(/\/$/, '') || '') + '/languages';
              }
              return u.toString();
            } catch (e) {
              return apiUrl.replace(/\/translate(.*)$/i, '/languages$1');
            }
          })();

          const headers = {};
          if ((apiUrl && apiUrl.toLowerCase().includes('deepl')) && apiKey) headers['Authorization'] = `DeepL-Auth-Key ${apiKey}`;
          const res = await fetch(languagesUrl, { method: 'GET', headers });
          const list = await res.json();
          let lines = [];
          if (Array.isArray(list)) {
            // items may be strings or objects
            for (const item of list) {
              if (typeof item === 'string') lines.push(item);
              else if (item.language || item.code) lines.push(`${item.language || item.code}${item.name ? ' — ' + item.name : ''}`);
              else lines.push(JSON.stringify(item));
            }
            const reply = `Supported target languages:\n${lines.join('\n')}\n\nUse: .tr <code> (reply to a message)`;
            return sock.sendMessage(jid, { text: reply });
          }
        } catch (e) {
          // fallback to static list below
          console.error('language list fetch failed', e);
        }

        // static fallback list
        const staticList = [
          ['EN', 'English'], ['DE', 'German'], ['FR', 'French'], ['ES', 'Spanish'], ['IT', 'Italian'], ['PT', 'Portuguese'], ['RU', 'Russian'],
          ['ZH', 'Chinese'], ['JA', 'Japanese'], ['KO', 'Korean'], ['NL', 'Dutch'], ['PL', 'Polish'], ['SV', 'Swedish'], ['NO', 'Norwegian'],
          ['DA', 'Danish'], ['FI', 'Finnish'], ['RO', 'Romanian'], ['HU', 'Hungarian'], ['CS', 'Czech'], ['TR', 'Turkish'], ['AR', 'Arabic']
        ];
        const reply = 'Supported target languages (fallback):\n' + staticList.map(x => `${x[0]} — ${x[1]}`).join('\n') + '\n\nUse: .tr <code> (reply to a message)';
        return sock.sendMessage(jid, { text: reply });
      }
      const fetch = await getFetch();

      // If DeepL is detected, use form-encoded fields as DeepL expects
      const isDeepL = (apiUrl && apiUrl.toLowerCase().includes('deepl')) || (cfg && (cfg.translateService === 'deepl' || cfg.translate_service === 'deepl'));
      let js = null;
      if (isDeepL) {
        const params = new URLSearchParams();
        params.append('text', quoted);
        // DeepL expects target language in uppercase (e.g., EN, DE, FR)
        params.append('target_lang', (lang || '').toUpperCase());
        // include auth_key in body as fallback, but DeepL requires the Authorization header
        if (apiKey) params.append('auth_key', apiKey);
        const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
        if (apiKey) headers['Authorization'] = `DeepL-Auth-Key ${apiKey}`;
        const res = await fetch(apiUrl, { method: 'POST', headers, body: params.toString() });
        js = await res.json();
      } else {
        // Try a generic POST payload { q, target } which many services accept (LibreTranslate, some wrappers)
        const payload = { q: quoted, target: lang };
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
        const res = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
        js = await res.json();
      }

      // Accept several common response shapes
      let out = null;
      if (typeof js === 'string') out = js;
      else if (js.translatedText) out = js.translatedText; // LibreTranslate
      else if (js.data && js.data.translations && js.data.translations[0] && js.data.translations[0].translatedText) out = js.data.translations[0].translatedText; // Google
      else if (js.translations && js.translations[0] && (js.translations[0].text || js.translations[0].translatedText)) out = js.translations[0].text || js.translations[0].translatedText; // DeepL-like
      else if (js.result) out = js.result;
      else out = JSON.stringify(js);

      await sock.sendMessage(jid, { text: `(${lang}) ${out}` });
    } catch (e) {
      console.error('translate error', e);
      await sock.sendMessage(jid, { text: 'Translation failed: ' + (e.message || String(e)) });
    }
  }
};
