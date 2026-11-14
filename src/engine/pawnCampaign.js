const FILES = "abcdefgh";
const START = [
  "rnbqkbnr".split(""),
  "pppppppp".split(""),
  Array(8).fill(null), Array(8).fill(null), Array(8).fill(null), Array(8).fill(null),
  "PPPPPPPP".split(""),
  "RNBQKBNR".split(""),
];
const copyBoard = (board) => board.map((row) => row.slice());
const colorOf = (piece) => piece ? (piece === piece.toUpperCase() ? "w" : "b") : null;
const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const square = (r, c) => FILES[c] + (8 - r);

export function createPawnCampaign() {
  return { board: copyBoard(START), turn: "w", history: [], bossRevealed: false, playerPawnsTaken: 0, bossPawnsLeft: 8, result: null, lastMove: null };
}

export function campaignFen(state) {
  const rows = state.board.map((row) => {
    let out = "", empty = 0;
    for (const piece of row) {
      if (!piece) empty++;
      else { if (empty) out += empty; empty = 0; out += piece; }
    }
    if (empty) out += empty;
    return out;
  });
  return rows.join("/") + " " + state.turn + " - - 0 " + (Math.floor(state.history.length / 2) + 1);
}

export function campaignMoves(state, from = null) {
  const moves = [];
  const add = (r, c, tr, tc) => {
    if (!inside(tr, tc)) return false;
    const target = state.board[tr][tc];
    if (target && colorOf(target) === state.turn) return false;
    moves.push({ from: square(r, c), to: square(tr, tc), piece: state.board[r][c], captured: target || null });
    return !target;
  };
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const piece = state.board[r][c];
    if (!piece || colorOf(piece) !== state.turn || (from && square(r,c) !== from)) continue;
    const type = piece.toLowerCase(), dir = state.turn === "w" ? -1 : 1;
    if (type === "p") {
      const nr = r + dir;
      if (inside(nr,c) && !state.board[nr][c]) {
        add(r,c,nr,c);
        if ((state.turn === "w" && r === 6) || (state.turn === "b" && r === 1)) {
          if (!state.board[r + 2*dir][c]) add(r,c,r+2*dir,c);
        }
      }
      for (const dc of [-1,1]) if (inside(nr,c+dc) && state.board[nr][c+dc] && colorOf(state.board[nr][c+dc]) !== state.turn) add(r,c,nr,c+dc);
    } else if (type === "n") {
      for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) add(r,c,r+dr,c+dc);
    } else {
      const dirs = type === "b" ? [[-1,-1],[-1,1],[1,-1],[1,1]]
        : type === "r" ? [[-1,0],[1,0],[0,-1],[0,1]]
        : type === "q" ? [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]
        : [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]];
      for (const [dr,dc] of dirs) {
        let tr = r + dr, tc = c + dc;
        while (inside(tr,tc)) {
          const keep = add(r,c,tr,tc);
          if (!keep || type === "k") break;
          tr += dr; tc += dc;
        }
      }
    }
  }
  return moves;
}

const value = { p:100, n:310, b:330, r:500, q:900, k:0 };
function scoreMove(state, move) {
  const type = move.piece.toLowerCase();
  const tr = 8 - Number(move.to[1]), tc = FILES.indexOf(move.to[0]);
  let score = move.captured ? value[move.captured.toLowerCase()] * 1.3 : 0;
  if (type === "p") {
    score += (state.turn === "b" ? tr : 7-tr) * 13;
    if (move.captured) score += 85;
    if ((state.turn === "b" && tr === 7) || (state.turn === "w" && tr === 0)) score += 1000;
    if (tc >= 2 && tc <= 5) score += 12;
  }
  if (type === "k" && state.turn === "b" && tr === 7) score += 700;
  if (type === "q" || type === "r") score += 5;
  // Small deterministic variation avoids repeating a single tie-break pattern.
  score += ((tr * 7 + tc * 11 + state.history.length * 3) % 9);
  return score;
}

export function choosePawnBossMove(state) {
  const candidates = campaignMoves(state);
  if (!candidates.length) return null;
  return candidates.map((move) => ({ move, score: scoreMove(state, move) }))
    .sort((a,b) => b.score-a.score)[0].move;
}

export function applyCampaignMove(state, from, to) {
  if (state.result) return { state, move: null };
  const move = campaignMoves(state, from).find((candidate) => candidate.to === to);
  if (!move) return { state, move: null };
  const next = { ...state, board: copyBoard(state.board), history: [...state.history], lastMove: null };
  const fr = 8 - Number(from[1]), fc = FILES.indexOf(from[0]);
  const tr = 8 - Number(to[1]), tc = FILES.indexOf(to[0]);
  let piece = next.board[fr][fc];
  const captured = next.board[tr][tc];
  next.board[fr][fc] = null;
  // Boss abilities are dormant until the player captures the first black pawn.
  // From the following boss turn onward, its pawn and king transformations activate.
  if (state.bossRevealed && colorOf(piece) === "b" && piece === "p" && captured && colorOf(captured) === "w") piece = "q";
  if (state.bossRevealed && colorOf(piece) === "b" && piece === "k" && tr === 7) piece = "q";
  // Ordinary pawn promotion is automatic to queen in this campaign.
  if (piece === "P" && tr === 0) piece = "Q";
  if (piece === "p" && tr === 7) piece = "q";
  next.board[tr][tc] = piece;
  if (colorOf(captured) === "b" && captured.toLowerCase() === "p") {
    next.bossPawnsLeft = Math.max(0, next.bossPawnsLeft - 1);
  }
  if (colorOf(piece) === "w" && captured && captured.toLowerCase() === "p" && !next.bossRevealed) {
    next.bossRevealed = true;
    next.playerPawnsTaken += 1;
  }
  next.turn = next.turn === "w" ? "b" : "w";
  next.lastMove = { from, to, captured, piece };
  next.history.push({ from, to, piece, captured, san: from + (captured ? "x" : "-") + to });
  if (next.bossPawnsLeft === 0) next.result = "win";
  else if (campaignMoves(next).length === 0) next.result = next.turn === "w" ? "loss" : "win";
  return { state: next, move: next.lastMove };
}
