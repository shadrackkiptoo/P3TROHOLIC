module.exports = {
  name: 'menu',
  aliases: ['.menu'],
  description: 'Show available commands',
  async execute({ sock, msg, jid, helpers }) {
    try {
      // Only display a small public subset; other commands are private and available in DM
      const publicNames = new Set(['ginfo', 'st', 'tr', 'admin', 'ttt']);
      const cmds = (helpers.commands || []).slice().filter(c => {
        if (!c) return false;
        const names = [c.name, ...(c.aliases || [])]
          .map(name => name.replace(/^\./, ''));
        return names.some(name => publicNames.has(name));
      }).sort((a,b) => a.name.localeCompare(b.name));
      const lines = [];
      lines.push('╔════════════════════════════════════╗');
      lines.push('║       P3TROHOLIC — Command List     ║');
      lines.push('╠════════════════════════════════════╣');

      for (const c of cmds) {
        const rawPrimary = '.' + c.name.replace(/^\./, '');
        const primary = `*${rawPrimary}*`;
        const aliasList = (c.aliases && c.aliases.length > 1) ? ` (aliases: ${c.aliases.slice(1).join(',')})` : '';
        const name = primary.padEnd(14);
        const desc = (c.description || '').slice(0, 30);
        lines.push(`║ ${name} ${desc.padEnd(30)}${aliasList} ║`);
      }

      lines.push('╠════════════════════════════════════╣');
      lines.push('║ Notes:                             ║');
      lines.push('╟────────────────────────────────────╢');
      lines.push('║ Public commands shown above only.  ║');
      lines.push('║ Other commands are private       ║');
      lines.push('╚════════════════════════════════════╝');

      await sock.sendMessage(jid, { text: lines.join('\n') });
    } catch (e) {
      console.error('menu command error:', e);
      await sock.sendMessage(jid, { text: 'Failed to build menu.' });
    }
  }
};
