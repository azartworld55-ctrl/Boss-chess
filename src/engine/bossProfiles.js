export const BOSS_PROFILES = {
  pawn: {
    id: "pawn",
    name: "Пешка",
    multiPv: 5,
    depth: 16,
    preferences: {
      pawnAdvance: 34,
      pawnCapture: 58,
      pawnPromotion: 100,
      kingAdvance: 42,
      centerControl: 8,
    },
  },
};

export function parseUciInfo(line) {
  if (typeof line !== "string" || !line.startsWith("info ")) return null;
  const depth = Number(line.match(/\bdepth (\\d+)/)?.[1] || 0);
  const multipv = Number(line.match(/\bmultipv (\\d+)/)?.[1] || 1);
  const scoreMatch = line.match(/\bscore (cp|mate) (-?\\d+)/);
  const pvMatch = line.match(/\bpv (.+)$/);
  if (!pvMatch) return null;
  return {
    depth,
    multipv,
    scoreType: scoreMatch?.[1] || "cp",
    score: Number(scoreMatch?.[2] || 0),
    moves: pvMatch[1].trim().split(/\s+/),
  };
}

function evaluateFirstMove(game, uci, profile) {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const movingPiece = game.get(from);
  if (!movingPiece) return Number.NEGATIVE_INFINITY;

  const file = to.charCodeAt(0) - 97;
  const rank = Number(to[1]);
  const forward = movingPiece.color === "w" ? rank - Number(from[1]) : Number(from[1]) - rank;
  const promotionRank = movingPiece.color === "w" ? 8 : 1;
  let bonus = 0;

  try {
    const copy = new game.constructor(game.fen());
    const move = copy.move({
      from,
      to,
      ...(uci.length > 4 ? { promotion: uci[4].toLowerCase() } : {}),
    });
    if (movingPiece.type === "p") {
      if (forward > 0) bonus += profile.preferences.pawnAdvance * Math.min(forward, 2);
      if (move.captured) bonus += profile.preferences.pawnCapture;
      if (rank === promotionRank) bonus += profile.preferences.pawnPromotion;
    }
    if (movingPiece.type === "k" && rank === promotionRank) {
      bonus += profile.preferences.kingAdvance;
    }
    if (file >= 2 && file <= 5) bonus += profile.preferences.centerControl;
    if (move.captured && movingPiece.type !== "p") bonus += 3;
  } catch {
    return Number.NEGATIVE_INFINITY;
  }
  return bonus;
}

export function chooseBossMove(game, candidates, profileId = "pawn") {
  const profile = BOSS_PROFILES[profileId];
  if (!profile || !Array.isArray(candidates) || candidates.length === 0) return null;

  const legal = candidates
    .filter((candidate) => candidate?.moves?.length)
    .map((candidate) => ({
      ...candidate,
      uci: candidate.moves[0],
      personalityBonus: evaluateFirstMove(game, candidate.moves[0], profile),
    }))
    .filter((candidate) => Number.isFinite(candidate.personalityBonus));

  if (!legal.length) return null;

  const deepest = Math.max(...legal.map((candidate) => candidate.depth || 0));
  const sameDepth = legal.filter((candidate) => (candidate.depth || 0) === deepest);
  const bestScore = Math.max(...sameDepth.map((candidate) => candidate.scoreType === "mate"
    ? candidate.score > 0 ? 100000 : -100000
    : candidate.score));
  const nearBest = sameDepth.filter((candidate) => {
    const score = candidate.scoreType === "mate"
      ? candidate.score > 0 ? 100000 : -100000
      : candidate.score;
    return bestScore - score <= 110;
  });

  return nearBest
    .map((candidate) => ({
      ...candidate,
      total: candidate.personalityBonus + (candidate.scoreType === "mate"
        ? candidate.score > 0 ? 10000 : -10000
        : candidate.score * 0.12),
    }))
    .sort((a, b) => b.total - a.total || a.multipv - b.multipv)[0].uci;
}
