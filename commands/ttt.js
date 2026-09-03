const games = new Map();

function getSender(msg, jid) {
  return (msg.key && (msg.key.participant || msg.key.remoteJid)) || jid;
}

function getMentionedJid(msg) {
  const context = msg.message && msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo;
  return context && context.mentionedJid && context.mentionedJid[0];
}

function renderBoard(board) {
  const emojiMap = { X: '❌', O: '⭕', 1: '1️⃣', 2: '2️⃣', 3: '3️⃣', 4: '4️⃣', 5: '5️⃣', 6: '6️⃣', 7: '7️⃣', 8: '8️⃣', 9: '9️⃣' };
  return board.map((mark, index) => mark ? emojiMap[mark] : emojiMap[String(index + 1)]).reduce((rows, cell, index) => {
    if (index % 3 === 0) rows.push([]);
    rows[rows.length - 1].push(cell);
    return rows;
  }, []).map(row => row.join(' │ ')).join('\n───────────\n');
}

function getWinner(board) {
  const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const winningLine = lines.find(([a, b, c]) => board[a] && board[a] === board[b] && board[a] === board[c]);
  return winningLine ? board[winningLine[0]] : null;
}

function getAvailablePositions(board) {
  return board.reduce((positions, mark, index) => {
    if (!mark) positions.push(index);
    return positions;
  }, []);
}

function formatPlayer(jid) {
  return `@${jid.split('@')[0]}`;
}

function formatGame(game) {
  const currentPlayer = game.turn === 'O' && game.solo ? '🤖 Bot' : formatPlayer(game.players[game.turn]);
  return `🎮 *TIC-TAC-TOE MATCH*\n\n${renderBoard(game.board)}\n\n❌ *Player X:* ${formatPlayer(game.players.X)}\n⭕ *Player O:* ${game.solo ? '🤖 Bot' : formatPlayer(game.players.O)}\n\n⏳ *Current Turn:* ${currentPlayer}`;
}

module.exports = {
  name: '.ttt',
  aliases: ['tictactoe'],
  description: 'Play Tic-Tac-Toe in a group',
  async execute({ sock, msg, jid, textTrim }) {
    if (!jid || !jid.endsWith('@g.us')) {
      await sock.sendMessage(jid, { text: '❌ Tic-Tac-Toe can only be played inside group chats.' });
      return;
    }

    const sender = getSender(msg, jid);
    const args = textTrim.replace(/^\.ttt\b/i, '').trim().split(/\s+/).filter(Boolean);
    const action = args[0] && args[0].toLowerCase();
    const game = games.get(jid);

    if (action === 'stop' || action === 'end') {
      if (!game) return sock.sendMessage(jid, { text: '❌ There is no active game running in this group.' });
      if (game.players.X !== sender && game.players.O !== sender) return sock.sendMessage(jid, { text: '❌ Only the active players can terminate this session.' });
      games.delete(jid);
      return sock.sendMessage(jid, { text: '🏁 Game session closed successfully.' });
    }

    if (!game) {
      const opponent = getMentionedJid(msg);
      if (opponent === sender) return sock.sendMessage(jid, { text: '❌ You cannot select yourself as an opponent.' });
      const newGame = { board: Array(9).fill(''), players: { X: sender, O: opponent || 'bot' }, turn: 'X', solo: !opponent };
      games.set(jid, newGame);
      const modeText = opponent ? '⚔️ Match configured! Use `.ttt [1-9]` to place your move.' : '🤖 Solo mode enabled! You are playing against the system engine. Use `.ttt [1-9]`.';
      return sock.sendMessage(jid, { text: `${formatGame(newGame)}\n\n${modeText}`, mentions: opponent ? [sender, opponent] : [sender] }, { quoted: msg });
    }

    if (game.players.X !== sender && game.players.O !== sender) return sock.sendMessage(jid, { text: '⚠️ A match is already running in this group. Use `.ttt stop` to abort it.' }, { quoted: msg });
    if (game.players[game.turn] !== sender) return sock.sendMessage(jid, { text: `⏳ Hold on! It is currently ${game.turn === 'O' && game.solo ? 'the bot' : formatPlayer(game.players[game.turn])}'s turn.`, mentions: game.solo ? [game.players.X] : [game.players[game.turn]] }, { quoted: msg });

    const position = Number(action) - 1;
    if (!Number.isInteger(position) || position < 0 || position > 8 || game.board[position]) return sock.sendMessage(jid, { text: '❌ Selection invalid. Choose an empty number slot from [1 - 9].' }, { quoted: msg });

    game.board[position] = game.turn;
    const winnerMark = getWinner(game.board);
    if (winnerMark) {
      const winnerJid = game.players[winnerMark];
      games.delete(jid);
      return sock.sendMessage(jid, { text: `${formatGame(game)}\n\n🏆 *CONGRATULATIONS!*\n🎉 ${winnerMark === 'O' && game.solo ? 'The bot' : formatPlayer(winnerJid)} has won the match!`, mentions: game.solo ? [game.players.X] : [winnerJid] });
    }
    if (game.board.every(Boolean)) {
      games.delete(jid);
      return sock.sendMessage(jid, { text: `${formatGame(game)}\n\n🤝 *It's a tie!* No available slots remaining.` });
    }

    game.turn = game.turn === 'X' ? 'O' : 'X';
    if (game.solo && game.turn === 'O') {
      const available = getAvailablePositions(game.board);
      const botPosition = available[Math.floor(Math.random() * available.length)];
      game.board[botPosition] = 'O';
      if (getWinner(game.board)) {
        games.delete(jid);
        return sock.sendMessage(jid, { text: `${formatGame(game)}\n\n🤖 *Game Over!* The bot has defeated you.`, mentions: [game.players.X] });
      }
      if (game.board.every(Boolean)) {
        games.delete(jid);
        return sock.sendMessage(jid, { text: `${formatGame(game)}\n\n🤝 *It's a tie!* No available slots remaining.`, mentions: [game.players.X] });
      }
      game.turn = 'X';
    }

    return sock.sendMessage(jid, { text: formatGame(game), mentions: game.solo ? [game.players.X] : [game.players.X, game.players.O] });
  }
};
