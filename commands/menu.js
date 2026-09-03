module.exports = {
  name: 'menu',
  aliases: ['.menu'],
  description: 'Show available commands',
  async execute({ sock, msg, jid, helpers }) {
    try {
      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);

      let menuText = `🤖 *P3TROHOLIC INTERACTIVE BOT*\n`;
      menuText += `✨ _Status:_ Online | ⏱️ _Uptime:_ ${hours}h ${minutes}m\n\n`;
      menuText += `👑 *𝖦𝖱𝖮𝖴𝖯 𝖬𝖮𝖣𝖤𝖱𝖠𝖳𝖨𝖮𝖭*\n`;
      menuText += `│ ☛ _.admin_ - Group administration\n`;
      menuText += `│ ☛ _.hidetag_ - Ghost tag the whole group\n`;
      menuText += `│ ☛ _.filter_ - Manage group word filters\n\n`;
      menuText += `🎨 *𝖬𝖤𝖣𝖨𝖠 & 𝖥𝖴𝖭*\n`;
      menuText += `│ ☛ _.st_ - Convert image to sticker\n`;
      menuText += `│ ☛ _.vv_ - Re-send view-once media\n\n`;
      menuText += `⚙️ *𝖴𝖳𝖨𝖫𝖨𝖳𝖸*\n`;
      menuText += `│ ☛ _.ginfo_ - Show group information\n`;
      menuText += `│ ☛ _.tr_ - Translate a replied message\n`;
      menuText += `│ ☛ _.schedule_ - Schedule a message\n\n`;
      menuText += `✨ _Tip: Reply to messages directly to apply commands!_`;

      await sock.sendMessage(jid, { text: menuText }, { quoted: msg });
    } catch (e) {
      console.error('menu command error:', e);
      await sock.sendMessage(jid, { text: 'Failed to build menu.' });
    }
  }
};
