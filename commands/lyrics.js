module.exports = {
  name: 'lyrics',
  aliases: ['.lyrics', '.lyric'],
  description: 'Search lyrics for any track.',
  async execute({ sock, msg, jid, textTrim }) {
    const song = (textTrim || '').replace(/^\.(?:lyrics|lyric)\b/i, '').trim();
    if (!song) {
      return sock.sendMessage(jid, { text: '❌ Provide a song name! Example: `.lyrics Blinding Lights`' });
    }

    try {
      const response = await fetch(`https://some-random-api.com/lyrics?title=${encodeURIComponent(song)}`);
      if (!response.ok) throw new Error(`Lyrics API returned HTTP ${response.status}`);
      const data = await response.json();
      if (data.error || !data.lyrics) return sock.sendMessage(jid, { text: '❌ Song lyrics not found.' });

      const lyricPayload = `🎵 *LYRICS CENTER* 🎵\n\n🎼 *Title:* ${data.title || song}\n👤 *Artist:* ${data.author || 'Unknown'}\n\n${data.lyrics}`;
      const imageUrl = data.thumbnail?.genius;
      if (imageUrl) {
        return sock.sendMessage(jid, { image: { url: imageUrl }, caption: lyricPayload }, { quoted: msg });
      }
      return sock.sendMessage(jid, { text: lyricPayload }, { quoted: msg });
    } catch (error) {
      console.error('lyrics: failed to fetch lyrics:', error);
      return sock.sendMessage(jid, { text: '❌ Database error fetching lyrics.' });
    }
  }
};