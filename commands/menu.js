module.exports = {
  name: 'menu',
  aliases: ['.menu'],
  description: 'Show available commands',
  async execute({ sock, msg, jid, helpers }) {
    try {
      // Only display a small public subset; other commands are private and available in DM
      const publicNames = new Set(['ginfo', 'st', 'tr']);
      const publicAliases = new Set(['.ginfo', '.st', '.tr']);
      const cmds = (helpers.commands || []).slice().filter(c => {
        if (!c) return false;
        if (publicNames.has(c.name)) return true;
        if (c.aliases && c.aliases.some(a => publicAliases.has(a))) return true;
        return false;
      }).sort((a,b) => a.name.localeCompare(b.name));
      const lines = [];
      lines.push('╔════════════════════════════════════╗');
      lines.push('║       P3TROHOLIC — Command List     ║');
      lines.push('╠════════════════════════════════════╣');

      for (const c of cmds) {
        const rawPrimary = (c.aliases && c.aliases.length) ? c.aliases[0] : ('.' + c.name);
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
