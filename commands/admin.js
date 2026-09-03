module.exports = {
  name: '.admin',
  aliases: ['admin'],
  description: 'Group admin tools: add/remove/promote/demote/subject/desc',
  async execute({ sock, msg, jid, helpers, textTrim }) {
    try {
      if (!jid || !jid.endsWith('@g.us')) {
        await sock.sendMessage(jid, { text: 'This command only works in groups.' }, { quoted: msg });
        return;
      }

      const parts = textTrim.split(/\s+/);
      const sub = parts[1] && parts[1].toLowerCase();
      if (!sub) {
        await sock.sendMessage(jid, { text: 'Usage: .admin <add|remove|promote|demote|subject|desc> <numbers or @mentions or reply>' }, { quoted: msg });
        return;
      }

      // helper to extract JIDs from mentions, args (phone numbers) or a quoted contact
      const extractTargets = () => {
        // mentioned JIDs (direct mentions)
        const ext = (msg.message && msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo) || {};
        if (ext.mentionedJid && ext.mentionedJid.length) return ext.mentionedJid;

        // quoted contact
        const quoted = ext.quotedMessage;
        if (quoted && quoted.contactMessage && quoted.contactMessage.vcard) {
          const vcard = quoted.contactMessage.vcard;
          const m = vcard.match(/waid=(\d+)/);
          if (m) return [m[1] + '@s.whatsapp.net'];
        }

        // numbers passed as args
        const nums = [];
        for (let i = 2; i < parts.length; i++) {
          const cleaned = parts[i].replace(/[^0-9]/g, '');
          if (cleaned.length >= 5) nums.push(cleaned + '@s.whatsapp.net');
        }
        return nums;
      };

      const targets = extractTargets();

      if (['add', 'remove', 'promote', 'demote'].includes(sub) && (!targets || !targets.length)) {
        await sock.sendMessage(jid, { text: `No targets found. Reply to a contact, mention users, or pass phone numbers. Usage: .admin ${sub} <numbers or @mentions>` }, { quoted: msg });
        return;
      }

      if (sub === 'add') {
        await sock.groupParticipantsUpdate(jid, targets, 'add');
        await sock.sendMessage(jid, { text: 'User added to the group.' }, { quoted: msg });
        return;
      }

      if (sub === 'remove' || sub === 'kick') {
        await sock.groupParticipantsUpdate(jid, targets, 'remove');
        await sock.sendMessage(jid, { text: 'User removed from the group.' }, { quoted: msg });
        return;
      }

      if (sub === 'promote') {
        await sock.groupParticipantsUpdate(jid, targets, 'promote');
        await sock.sendMessage(jid, { text: 'User promoted to admin.' }, { quoted: msg });
        return;
      }

      if (sub === 'demote') {
        await sock.groupParticipantsUpdate(jid, targets, 'demote');
        await sock.sendMessage(jid, { text: 'User demoted from admin.' }, { quoted: msg });
        return;
      }

      if (sub === 'subject') {
        const subject = parts.slice(2).join(' ');
        if (!subject) {
          await sock.sendMessage(jid, { text: 'Usage: .admin subject <new subject>' }, { quoted: msg });
          return;
        }
        await sock.groupUpdateSubject(jid, subject);
        await sock.sendMessage(jid, { text: `Group subject updated to: ${subject}` }, { quoted: msg });
        return;
      }

      if (sub === 'desc' || sub === 'description') {
        const desc = parts.slice(2).join(' ');
        if (!desc) {
          await sock.sendMessage(jid, { text: 'Usage: .admin desc <new description>' }, { quoted: msg });
          return;
        }
        await sock.groupUpdateDescription(jid, desc);
        await sock.sendMessage(jid, { text: `Group description updated.` }, { quoted: msg });
        return;
      }

      // fallback
      await sock.sendMessage(jid, { text: 'Unknown admin subcommand. Supported: add, remove, promote, demote, subject, desc' }, { quoted: msg });
    } catch (e) {
      console.error('admin command error:', e);
      try { await sock.sendMessage(jid, { text: 'Error running admin command: ' + (e && e.message ? e.message : String(e)) }, { quoted: msg }); } catch (_) {}
    }
  }
};
