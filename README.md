# Boss Chess

A browser chess game. The first milestone is ordinary chess against the Stockfish computer engine. Bosses and special abilities will be designed later, after the classic game is working well.

## Current features

- Standard chess rules powered by `chess.js`
- Responsive board powered by `react-chessboard`
- Computer opponent powered by Stockfish 19 Lite (single-threaded WebAssembly)
- Three engine strength presets
- Move history, undo, restart, and pawn promotion choices
- Check, checkmate, stalemate, and draw detection

## Run locally

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Create a production build:

```bash
npm run build
npm run preview
```

The Vite build copies the Stockfish JavaScript and WebAssembly files into the output folder.

## GitHub Pages

The repository includes a GitHub Actions workflow for deployment. In the repository settings, open **Pages** and set the build and deployment source to **GitHub Actions**. Each push to `main` will then publish the site.

## Main technologies

- React
- Vite
- react-chessboard
- chess.js
- Stockfish.js

## Third-party licenses

- react-chessboard: MIT.
- chess.js: BSD-2-Clause.
- Stockfish.js / Stockfish engine: GPL-3.0.

Stockfish is distributed under GPL-3.0. Keep its license and notices with the engine files when redistributing the built application. Review each dependency's license before publishing modified or redistributed builds.