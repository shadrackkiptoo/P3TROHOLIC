const { fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');

(async () => {
  try {
    const version = await fetchLatestBaileysVersion();
    console.log('fetchLatestBaileysVersion ->', version);
  } catch (e) {
    console.error('fetchLatestBaileysVersion error:', e);
    process.exit(1);
  }
})();
