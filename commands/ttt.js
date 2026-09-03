const games = new Map();

function getSender(msg, jid) {
  return (msg.key && (msg.key.participant || msg.key.remoteJid)) || jid;
}

function getMentionedJid(msg) {
  const context = msg.message && msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo;
  return context && context.mentionedJid && context.mentionedJid[0];
}

function renderBoard(board) {
  return board.map((mark, index) => mark || String(index + 1)).reduce((rows, cell, index) => {
    if (index % 3 === 0) rows.push([]);
    rows[rows.length - 1].push(cell);
    return rows;
  }, []).map(row => ` ${row.join(' | ')} `).join('\n---+---+---\n');
}

function getWinner(board) {
  const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  return lines.find(([a, b, c]) => board[a] && board[a] === board[b] && board[a] === board[c]);
}

function getAvailablePositions(board) {
  return board.reduce((positions, mark, index) => {
    if (!mark) positions.push(index);
    return positions;
  }, []);
}

function formatGame(game) {
  return `Tic-Tac-Toe\n\n${renderBoard(game.board)}\n\nX: @${game.players.X.split('@')[0]}\nO: @${game.players.O.split('@')[0]}\nTurn: ${game.turn}`;
}

module.exports = {
  name: '.ttt',
  aliases: ['tictactoe'],
  description: 'Play Tic-Tac-Toe in a group',
  async execute({ sock, msg, jid, textTrim }) {
    if (!jid || !jid.endsWith('@g.us')) {
      await sock.sendMessage(jid, { text: 'Tic-Tac-Toe can only be played in a group.' });
      return;
    }

    const sender = getSender(msg, jid);
    const args = textTrim.replace(/^\.ttt\b/i, '').trim().split(/\s+/).filter(Boolean);
    const action = args[0] && args[0].toLowerCase();
    const game = games.get(jid);

    if (action === 'stop' || action === 'end') {
      if (!game) return sock.sendMessage(jid, { text: 'There is no Tic-Tac-Toe game running.' });
      if (game.players.X !== sender && game.players.O !== sender) return sock.sendMessage(jid, { text: 'Only the two players can stop this game.' });
      games.delete(jid);
      return sock.sendMessage(jid, { text: 'Tic-Tac-Toe stopped.' });
    }

    if (!game) {
      const opponent = getMentionedJid(msg);
      if (opponent === sender) return sock.sendMessage(jid, { text: 'Choose another player as your opponent.' });
      const newGame = {
        board: Array(9).fill(''),
        players: { X: sender, O: opponent || 'bot' },
        turn: 'X',
        solo: !opponent
      };
      games.set(jid, newGame);
      const mode = opponent ? `@${opponent.split('@')[0]} is your opponent.` : 'You are X. The bot is O.';
      return sock.sendMessage(jid, { text: `${formatGame(newGame)}\n\n${mode} Use .ttt <1-9> to move.` });
    }

    if (game.players.X !== sender && game.players.O !== sender) {
      return sock.sendMessage(jid, { text: 'A game is already running between the two players. Use .ttt stop to end it.' });
    }
    if (game.players[game.turn] !== sender) return sock.sendMessage(jid, { text: `It is ${game.turn}'s turn.` });

    const position = Number(action) - 1;
    if (!Number.isInteger(position) || position < 0 || position > 8 || game.board[position]) {
      return sock.sendMessage(jid, { text: 'Choose an empty square from 1 to 9.' });
    }

    game.board[position] = game.turn;
    const winner = getWinner(game.board);
    if (winner) {
      const winnerJid = game.players[game.turn];
      games.delete(jid);
      return sock.sendMessage(jid, { text: `${formatGame(game)}\n\nWinner: @${winnerJid.split('@')[0]}!` });
    }
    if (game.board.every(Boolean)) {
      games.delete(jid);
      return sock.sendMessage(jid, { text: `${formatGame(game)}\n\nIt is a draw!` });
    }

    game.turn = game.turn === 'X' ? 'O' : 'X';
    if (game.solo && game.turn === 'O') {
      const available = getAvailablePositions(game.board);
      const botPosition = available[Math.floor(Math.random() * available.length)];
      game.board[botPosition] = 'O';
      const botWinner = getWinner(game.board);
      if (botWinner) {
        games.delete(jid);
        return sock.sendMessage(jid, { text: `${formatGame(game)}\n\nThe bot wins!` });
      }
      if (game.board.every(Boolean)) {
        games.delete(jid);
        return sock.sendMessage(jid, { text: `${formatGame(game)}\n\nIt is a draw!` });
      }
      game.turn = 'X';
    }
    return sock.sendMessage(jid, { text: formatGame(game) });
  }
};