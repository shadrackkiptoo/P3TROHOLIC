const games = new Map();

function playerId(msg, jid) {
  return (msg.key && (msg.key.participant || msg.key.remoteJid)) || jid;
}

function playerLabel(id) {
  return String(id || 'player').split('@')[0];
}

// Visual Upgrade: Maps text arrays to aesthetic grid emojis to maintain layout sizing on mobile
function renderBoard(board) {
  const emojiMap = { 'X': '❌', 'O': '⭕', '1': '1️⃣', '2': '2️⃣', '3': '3️⃣', '4': '4️⃣', '5': '5️⃣', '6': '6️⃣', '7': '7️⃣', '8': '8️⃣', '9': '9️⃣' };
  const cells = board.map((mark, index) => mark ? emojiMap[mark] : emojiMap[String(index + 1)]);
  
  return `${cells[0]} │ ${cells[1]} │ ${cells[2]}\n───────────\n${cells[3]} │ ${cells[4]} │ ${cells[5]}\n───────────\n${cells[6]} │ ${cells[7]} │ ${cells[8]}`;
}

function winner(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

function instructions(game) {
  const turnJid = game.turn === 'X' ? game.x : game.o;
  return `🎮 *TIC-TAC-TOE MATCH*\n\n${renderBoard(game.board)}\n\n⏳ *Current Turn:* ${game.turn} (@${playerLabel(turnJid)})\n\n👉 *To Move:* Reply with \`.ttt [1-9]\`\n🛑 *To Stop:* Type \`.ttt reset\``;
}

module.exports = {
  name: 'ttt',
  aliases: ['.ttt', '.tictactoe'],
  description: 'Play Tic-Tac-Toe in a WhatsApp chat.',
  async execute({ sock, msg, jid, textTrim }) {
    const id = playerId(msg, jid);
    const args = (textTrim || '').trim().split(/\s+/);
    const argument = args[1]?.toLowerCase();
    let game = games.get(jid);

    // Command: Stop or Reset the game
    if (argument === 'reset' || argument === 'stop' || argument === 'end') {
      if (!game) return sock.sendMessage(jid, { text: '❌ There is no active game running right now.' });
      if (id !== game.x && id !== game.o) return sock.sendMessage(jid, { text: '❌ Only active match participants can close this game.' });
      
      games.delete(jid);
      return sock.sendMessage(jid, { text: '🏁 Match session terminated. Send \`.ttt\` to begin fresh.' });
    }

    // Command: Initialize New Session
    if (!game) {
      game = { board: Array(9).fill(null), x: id, o: null, turn: 'X' };
      games.set(jid, game);
      return sock.sendMessage(jid, {
        text: `🎮 *TIC-TAC-TOE INITIALIZED*\n\n${renderBoard(game.board)}\n\n❌ *Player X:* @${playerLabel(id)}\n⭕ *Player O:* [Waiting for player to type \`.ttt\`]\n\n👉 Send \`.ttt [1-9]\` to claim a position.`,
        mentions: [id]
      }, { quoted: msg });
    }

    if (!argument) {
      const activeMentions = [game.x];
      if (game.o) activeMentions.push(game.o);
      return sock.sendMessage(jid, { text: instructions(game), mentions: activeMentions });
    }

    if (argument === 'help') {
      return sock.sendMessage(jid, { text: '📝 *TIC-TAC-TOE GUIDE*\n\n• \`.ttt\` - Show active game status\n• \`.ttt [1-9]\` - Place your icon token\n• \`.ttt reset\` - Terminate current session' });
    }

    const square = Number(argument);
    if (!Number.isInteger(square) || square < 1 || square > 9) {
      const activeMentions = [game.x];
      if (game.o) activeMentions.push(game.o);
      return sock.sendMessage(jid, { text: '⚠️ Selection invalid. Choose an available slot from 1 to 9.\n\n' + instructions(game), mentions: activeMentions });
    }

    // Auto-assign Player O if slot is free and it's not Player X
    if (!game.o && id !== game.x) game.o = id;

    // Restrict spectators from typing game commands
    if (id !== game.x && id !== game.o) {
      return sock.sendMessage(jid, { text: '⚠️ This game session is already full. Wait for this match to end.' });
    }

    const mark = id === game.x ? 'X' : 'O';
    if (mark !== game.turn) {
      const turnJid = game.turn === 'X' ? game.x : game.o;
      return sock.sendMessage(jid, { 
        text: `⏳ Hold on! It is currently @${playerLabel(turnJid)}'s turn.\n\n${instructions(game)}`,
        mentions: [turnJid]
      });
    }

    if (game.board[square - 1]) {
      const activeMentions = [game.x, game.o];
      return sock.sendMessage(jid, { text: '❌ That slot is already occupied!\n\n' + instructions(game), mentions: activeMentions });
    }

    // Process Move Action
    game.board[square - 1] = mark;
    
    // Evaluate Win Condition
    const winningMark = winner(game.board);
    if (winningMark) {
      const winningPlayer = winningMark === 'X' ? game.x : game.o;
      games.delete(jid);
      return sock.sendMessage(jid, { 
        text: `🏆 *MATCH OVER!*\n\n${renderBoard(game.board)}\n\n🎉 Congratulations @${playerLabel(winningPlayer)}, **${winningMark}** wins the match!`, 
        mentions: [winningPlayer]
      });
    }

    // Evaluate Draw Condition
    if (game.board.every(Boolean)) {
      games.delete(jid);
      return sock.sendMessage(jid, { text: `🤝 *IT'S A DRAW!*\n\n${renderBoard(game.board)}\n\nNo available spaces left. Send \`.ttt\` to play a rematch.` });
    }

    // Cycle Turn Engine
    game.turn = mark === 'X' ? 'O' : 'X';
    const nextTurnJid = game.turn === 'X' ? game.x : game.o;
    const activeMentions = nextTurnJid ? [nextTurnJid] : [game.x];

    return sock.sendMessage(jid, { 
      text: instructions(game), 
      mentions: activeMentions 
    });
  }
};
