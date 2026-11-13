import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";

describe("Boss Chess rules foundation", () => {
  it("starts from the standard chess position", () => {
    const game = new Chess();
    expect(game.fen()).toContain("rnbqkbnr/pppppppp");
    expect(game.turn()).toBe("w");
  });
  it("accepts a legal move and changes the side to move", () => {
    const game = new Chess();
    expect(game.move({ from: "e2", to: "e4" }).san).toBe("e4");
    expect(game.turn()).toBe("b");
  });
  it("rejects an illegal move without changing the position", () => {
    const game = new Chess();
    const before = game.fen();
    expect(() => game.move({ from: "e2", to: "e5" })).toThrow();
    expect(game.fen()).toBe(before);
  });
  it("recognizes checkmate", () => {
    const game = new Chess();
    ["f3", "e5", "g4", "Qh4#"].forEach((san) => game.move(san));
    expect(game.isCheckmate()).toBe(true);
  });
  it("supports undo", () => {
    const game = new Chess();
    game.move("e4");
    game.undo();
    expect(game.history()).toHaveLength(0);
    expect(game.turn()).toBe("w");
  });
});