module.exports = {
  name: '.hidetag',
  aliases: ['hidetag'],
  description: 'Ghost tag every member in a group',
  async execute({ sock, msg, jid, textTrim }) {
    if (!jid || !jid.endsWith('@g.us')) {
      await sock.sendMessage(jid, { text: 'This command can only be used in a group.' }, { quoted: msg });
      return;
    }

    try {
      const metadata = await sock.groupMetadata(jid);
      const mentions = (metadata.participants || [])
        .map(participant => participant.id || participant.jid || participant.participant)
        .filter(Boolean);
      const messageText = textTrim.replace(/^\.hidetag\b/i, '').trim();

      await sock.sendMessage(jid, {
        text: messageText || '\u200b',
        mentions
      }, { quoted: msg });
    } catch (error) {
      console.error('hidetag command error:', error);
      await sock.sendMessage(jid, { text: 'Unable to tag the group members.' }, { quoted: msg });
    }
  }
};