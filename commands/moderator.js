const fs = require('fs');
const path = require('path');

const FILTERS = path.join(__dirname, '..', 'data', 'filters.json');

function load() { try { return JSON.parse(fs.readFileSync(FILTERS, 'utf8') || '{}'); } catch (e) { return { groups: {} }; } }
function save(data) { fs.writeFileSync(FILTERS, JSON.stringify(data, null, 2)); }

module.exports = {
  name: '.filter',
  description: 'Manage word filters: `.filter add <word>` | `.filter remove <word>` | `.filter list`',
  async execute({ sock, msg, jid, textTrim }) {
    const parts = textTrim.split(/\s+/).slice(1);
    const action = parts[0];
    const group = jid;
    if (!group || !group.endsWith('@g.us')) return sock.sendMessage(jid, { text: '.filter must be used in a group.' });
    const data = load();
    data.groups = data.groups || {};
    data.groups[group] = data.groups[group] || [];

    if (action === 'add') {
      const word = parts.slice(1).join(' ').trim();
      if (!word) return sock.sendMessage(jid, { text: 'Usage: .filter add <word>' });
      if (!data.groups[group].includes(word)) data.groups[group].push(word);
      save(data);
      return sock.sendMessage(jid, { text: `Added filter: ${word}` });
    }
    if (action === 'remove') {
      const word = parts.slice(1).join(' ').trim();
      data.groups[group] = data.groups[group].filter(w => w !== word);
      save(data);
      return sock.sendMessage(jid, { text: `Removed filter: ${word}` });
    }
    // list
    return sock.sendMessage(jid, { text: `Filters: ${data.groups[group].join(', ')}` });
  }
};
