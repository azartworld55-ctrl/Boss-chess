import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { BOSS_PROFILES, chooseBossMove, parseUciInfo } from "./bossProfiles.js";

describe("Boss AI profiles", () => {
  it("defines an individual Pawn personality over Stockfish candidates", () => {
    expect(BOSS_PROFILES.pawn.multiPv).toBe(5);
    expect(BOSS_PROFILES.pawn.preferences.pawnCapture).toBeGreaterThan(0);
  });

  it("parses MultiPV candidate lines from UCI output", () => {
    expect(parseUciInfo("info depth 16 multipv 2 score cp 24 pv e7e5 g1f3")).toEqual({
      depth: 16,
      multipv: 2,
      scoreType: "cp",
      score: 24,
      moves: ["e7e5", "g1f3"],
    });
  });

  it("prefers an advancing pawn move when candidates are close in engine score", () => {
    const game = new Chess();
    game.move("e4");
    const candidates = [
      { depth: 16, multipv: 1, scoreType: "cp", score: 20, moves: ["g8f6"] },
      { depth: 16, multipv: 2, scoreType: "cp", score: 5, moves: ["d7d5"] },
    ];
    expect(chooseBossMove(game, candidates, "pawn")).toBe("d7d5");
  });

  it("returns null for unknown profiles or empty candidate lists", () => {
    const game = new Chess();
    expect(chooseBossMove(game, [], "pawn")).toBeNull();
    expect(chooseBossMove(game, [{ moves: ["e7e5"] }], "missing")).toBeNull();
  });
});
