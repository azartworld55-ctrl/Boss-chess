import { create } from "zustand";
import { persist } from "zustand/middleware";

export const DIFFICULTIES = {
  beginner: { label: "Начальный", skill: 2, depth: 7 },
  normal: { label: "Обычный", skill: 8, depth: 10 },
  strong: { label: "Сильный", skill: 15, depth: 13 },
};

export const useGameSettings = create(
  persist(
    (set) => ({
      difficulty: "normal",
      soundEnabled: false,
      animationsEnabled: true,
      hintsEnabled: true,
      lastMoveEnabled: true,
      coordinatesEnabled: false,
      setDifficulty: (difficulty) => set({ difficulty }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setAnimationsEnabled: (animationsEnabled) => set({ animationsEnabled }),
      setHintsEnabled: (hintsEnabled) => set({ hintsEnabled }),
      setLastMoveEnabled: (lastMoveEnabled) => set({ lastMoveEnabled }),
      setCoordinatesEnabled: (coordinatesEnabled) => set({ coordinatesEnabled }),
    }),
    { name: "boss-chess-settings" },
  ),
);
