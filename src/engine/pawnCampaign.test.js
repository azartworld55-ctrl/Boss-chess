import { describe, expect, it } from "vitest";
import { applyCampaignMove, campaignMoves, createPawnCampaign, choosePawnBossMove } from "./pawnCampaign.js";

describe("Chapter 1: Pawn campaign rules", () => {
  it("starts as an ordinary hidden-opponent chess position", () => {
    const game = createPawnCampaign();
    expect(game.bossRevealed).toBe(false);
    expect(game.bossPawnsLeft).toBe(8);
    expect(campaignMoves(game)).toHaveLength(20);
  });

  it("reveals the boss only after the player captures a black pawn", () => {
    let game = createPawnCampaign();
    game = applyCampaignMove(game, "e2", "e4").state;
    game = applyCampaignMove(game, "d7", "d5").state;
    game = applyCampaignMove(game, "e4", "d5").state;
    expect(game.bossRevealed).toBe(true);
    expect(game.bossPawnsLeft).toBe(7);
  });

  it("keeps boss abilities dormant before the first pawn is captured", () => {
    const game = createPawnCampaign();
    game.board = Array.from({length:8},()=>Array(8).fill(null));
    game.board[3][3] = "p";
    game.board[4][4] = "R";
    game.turn = "b";
    const result = applyCampaignMove(game, "d5", "e4");
    expect(result.state.board[4][4]).toBe("p");
    expect(result.state.bossRevealed).toBe(false);
  });

  it("activates boss pawn and king abilities only after the reveal", () => {
    const game = createPawnCampaign();
    game.bossRevealed = true;
    game.board = Array.from({length:8},()=>Array(8).fill(null));
    game.board[3][3] = "p";
    game.board[4][4] = "R";
    game.turn = "b";
    const result = applyCampaignMove(game, "d5", "e4");
    expect(result.state.board[4][4]).toBe("q");
  });

  it("promotes a boss pawn immediately after it captures a player piece", () => {
    const game = createPawnCampaign();
    game.bossRevealed = true;
    game.board = Array.from({length:8},()=>Array(8).fill(null));
    game.board[3][3] = "p";
    game.board[4][4] = "R";
    game.turn = "b";
    const result = applyCampaignMove(game, "d5", "e4");
    expect(result.state.board[4][4]).toBe("q");
  });

  it("promotes the boss king when it reaches the player's back rank", () => {
    const game = createPawnCampaign();
    game.bossRevealed = true;
    game.board = Array.from({length:8},()=>Array(8).fill(null));
    game.board[6][0] = "k";
    game.turn = "b";
    const result = applyCampaignMove(game, "a2", "a1");
    expect(result.state.board[7][0]).toBe("q");
  });

  it("returns a legal move for the Pawn AI", () => {
    const game = createPawnCampaign();
    game.turn = "b";
    const choice = choosePawnBossMove(game);
    expect(choice).toBeTruthy();
    expect(campaignMoves(game).some((move) => move.from === choice.from && move.to === choice.to)).toBe(true);
  });

  it("wins when the final boss pawn is captured, regardless of the king", () => {
    const game = createPawnCampaign();
    game.board = Array.from({length:8},()=>Array(8).fill(null));
    game.board[6][0] = "R";
    game.board[7][0] = "p";
    game.bossPawnsLeft = 1;
    game.turn = "w";
    const result = applyCampaignMove(game, "a2", "a1");
    expect(result.state.result).toBe("win");
  });
});
