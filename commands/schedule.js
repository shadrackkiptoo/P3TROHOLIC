const fs = require('fs');
const path = require('path');

const SCHEDULE_FILE = path.join(__dirname, '..', 'data', 'schedule.json');

function load() { try { return JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8') || '{}'); } catch (e) { return { jobs: [] }; } }
function save(data) { fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(data, null, 2)); }

module.exports = {
  name: '.schedule',
  description: 'Schedule a message: `.schedule <ISO-datetime> | <message>` (owner only).',
  async execute({ sock, msg, jid, textTrim }) {
    const cfgPath = path.join(__dirname, '..', 'data', 'config.json');
    let cfg = { owner: null };
    try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8') || '{}'); } catch (e) { cfg = { owner: null }; }
    const sender = (msg.key && (msg.key.participant || msg.key.remoteJid)) || null;
    if (!cfg.owner) return sock.sendMessage(jid, { text: 'Owner not configured in data/config.json' });
    if (sender !== cfg.owner && !(msg.key && msg.key.fromMe)) return sock.sendMessage(jid, { text: 'Only owner may schedule messages.' });

    const rest = textTrim.replace(/^\.schedule\s*/i, '').split('|');
    if (rest.length < 2) return sock.sendMessage(jid, { text: 'Usage: .schedule <ISO-datetime> | <message>' });
    const at = rest[0].trim();
    const body = rest.slice(1).join('|').trim();
    const when = Date.parse(at);
    if (isNaN(when)) return sock.sendMessage(jid, { text: 'Invalid datetime. Use ISO format, e.g. 2026-09-04T12:00:00Z' });

    const data = load();
    data.jobs.push({ id: Date.now().toString(), when: new Date(when).toISOString(), jid, body });
    save(data);
    return sock.sendMessage(jid, { text: `Scheduled message at ${new Date(when).toISOString()}` });
  }
};
