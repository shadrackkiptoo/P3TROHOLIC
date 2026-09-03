const games = new Map();

function playerId(msg, jid) {
  return (msg.key && (msg.key.participant || msg.key.remoteJid)) || jid;
}

function playerLabel(id) {
  return String(id || 'player').split('@')[0];
}

function renderBoard(board) {
  const cells = board.map((mark, index) => mark || String(index + 1));
  return `${cells[0]} | ${cells[1]} | ${cells[2]}\n--+---+--\n${cells[3]} | ${cells[4]} | ${cells[5]}\n--+---+--\n${cells[6]} | ${cells[7]} | ${cells[8]}`;
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
  const turn = game.turn === 'X' ? game.x : game.o;
  return `${renderBoard(game.board)}\n\nTurn: ${game.turn} (${playerLabel(turn)})\nReply with .ttt <number> using 1-9.\nUse .ttt reset to end the game.`;
}

module.exports = {
  name: 'ttt',
  aliases: ['.ttt', '.tictactoe'],
  description: 'Play Tic-Tac-Toe in a WhatsApp chat.',
  async execute({ sock, msg, jid, textTrim }) {
    const id = playerId(msg, jid);
    const argument = (textTrim || '').trim().split(/\s+/)[1]?.toLowerCase();
    let game = games.get(jid);

    if (argument === 'reset' || argument === 'stop' || argument === 'end') {
      games.delete(jid);
      return sock.sendMessage(jid, { text: 'Tic-Tac-Toe ended. Send .ttt to start a new game.' });
    }

    if (!game) {
      game = { board: Array(9).fill(null), x: id, o: null, turn: 'X' };
      games.set(jid, game);
      return sock.sendMessage(jid, {
        text: `TIC-TAC-TOE\n\n${renderBoard(game.board)}\n\n${playerLabel(id)} is X.\nWaiting for another player.\nSend .ttt <number> using 1-9 to choose a square.`
      });
    }

    if (!argument) return sock.sendMessage(jid, { text: instructions(game) });

    if (argument === 'help') {
      return sock.sendMessage(jid, { text: 'TIC-TAC-TOE\n.ttt - start or show the game\n.ttt 1-9 - choose a square\n.ttt reset - end the game' });
    }

    const square = Number(argument);
    if (!Number.isInteger(square) || square < 1 || square > 9) {
      return sock.sendMessage(jid, { text: 'Choose a square from 1 to 9.\n\n' + instructions(game) });
    }

    if (!game.o && id !== game.x) game.o = id;
    if (id !== game.x && id !== game.o) {
      return sock.sendMessage(jid, { text: 'This game already has two players: X and O.' });
    }

    const mark = id === game.x ? 'X' : 'O';
    if (mark !== game.turn) {
      return sock.sendMessage(jid, { text: `It is ${game.turn}'s turn.\n\n${instructions(game)}` });
    }
    if (game.board[square - 1]) {
      return sock.sendMessage(jid, { text: 'That square is already taken.\n\n' + instructions(game) });
    }

    game.board[square - 1] = mark;
    const winningMark = winner(game.board);
    if (winningMark) {
      const winningPlayer = winningMark === 'X' ? game.x : game.o;
      games.delete(jid);
      return sock.sendMessage(jid, { text: `${renderBoard(game.board)}\n\n${winningMark} wins! Congratulations, ${playerLabel(winningPlayer)}.\nSend .ttt to play again.` });
    }
    if (game.board.every(Boolean)) {
      games.delete(jid);
      return sock.sendMessage(jid, { text: `${renderBoard(game.board)}\n\nDraw game.\nSend .ttt to play again.` });
    }

    game.turn = mark === 'X' ? 'O' : 'X';
    return sock.sendMessage(jid, { text: instructions(game) });
  }
};
