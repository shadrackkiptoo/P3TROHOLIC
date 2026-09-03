module.exports = {
  name: '.ginfo',
  description: 'Show group information.',
  async execute({ sock, msg, jid }) {
    if (!jid || !jid.endsWith('@g.us')) return sock.sendMessage(jid, { text: '.ginfo must be used in a group.' });
    try {
      const meta = await sock.groupMetadata(jid);
      const admins = (meta.participants || []).filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.id || p.jid || p.participant);
      const members = (meta.participants || []).map(p => p.id || p.jid || p.participant);
      const txt = `Subject: ${meta.subject || ''}\nDescription: ${meta.desc || meta.desc?.toString() || ''}\nMembers: ${members.length}\nAdmins: ${admins.length}`;
      await sock.sendMessage(jid, { text: txt });
    } catch (e) {
      console.error('ginfo failed', e);
      await sock.sendMessage(jid, { text: 'Failed to fetch group info.' });
    }
  }
};
