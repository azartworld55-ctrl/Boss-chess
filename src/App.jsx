import { useCallback, useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";

const ENGINE_PATH = "stockfish/stockfish-19-lite-single.js";
const LEVELS = {
  beginner: { label: "Начальный", skill: 2, depth: 7 },
  normal: { label: "Обычный", skill: 8, depth: 9 },
  strong: { label: "Сильный", skill: 15, depth: 11 },
};

function getStatus(game, thinking, engineReady) {
  if (game.isCheckmate()) {
    return game.turn() === "w" ? "Мат. Победил компьютер." : "Мат. Ты победил!";
  }
  if (game.isStalemate()) return "Пат. Ничья.";
  if (game.isThreefoldRepetition()) return "Ничья: троекратное повторение позиции.";
  if (game.isInsufficientMaterial()) return "Ничья: недостаточно материала.";
  if (game.isDraw()) return "Ничья.";
  if (thinking) return "Компьютер думает…";
  if (game.isCheck()) return "Шах! Твой ход.";
  if (!engineReady) return "Загружаем шахматный движок…";
  return "Твой ход — играй белыми.";
}

export default function App() {
  const [fen, setFen] = useState(() => new Chess().fen());
  const [history, setHistory] = useState([]);
  const [difficulty, setDifficulty] = useState("normal");
  const [engineReady, setEngineReady] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [promotion, setPromotion] = useState(null);
  const [engineError, setEngineError] = useState("");
  const workerRef = useRef(null);
  const gameRef = useRef(new Chess());
  const fenRef = useRef(fen);
  const thinkingRef = useRef(false);
  const ignoreBestMoveRef = useRef(false);
  const difficultyRef = useRef(difficulty);
  difficultyRef.current = difficulty;

  const game = gameRef.current;
  const finished = game.isGameOver();

  const syncPosition = useCallback((nextGame) => {
    gameRef.current = nextGame;
    const nextFen = nextGame.fen();
    fenRef.current = nextFen;
    setFen(nextFen);
    setHistory(nextGame.history());
  }, []);

  const playEngineMove = useCallback((uci) => {
    if (!uci || uci === "(none)" || uci === "0000") {
      setThinking(false);
      thinkingRef.current = false;
      return;
    }
    const current = gameRef.current;
    try {
      const move = {
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
      };
      if (uci.length > 4) move.promotion = uci[4].toLowerCase();
      current.move(move);
      syncPosition(current);
    } catch (error) {
      setEngineError("Движок вернул некорректный ход. Попробуй начать новую партию.");
    }
    setThinking(false);
    thinkingRef.current = false;
  }, [syncPosition]);

  useEffect(() => {
    const workerUrl = new URL(ENGINE_PATH, document.baseURI);
    const worker = new Worker(workerUrl);
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const message = String(event.data || "");
      if (message === "uciok") {
        worker.postMessage("isready");
      } else if (message === "readyok") {
        setEngineReady(true);
        const current = gameRef.current;
        if (current.turn() === "b" && !current.isGameOver() && !thinkingRef.current) {
          const level = LEVELS[difficultyRef.current];
          thinkingRef.current = true;
          setThinking(true);
          worker.postMessage("setoption name Skill Level value " + level.skill);
          worker.postMessage("position fen " + current.fen());
          worker.postMessage("go depth " + level.depth);
        }
      } else if (message.startsWith("bestmove ")) {
        const move = message.split(/\s+/)[1];
        if (ignoreBestMoveRef.current) {
          ignoreBestMoveRef.current = false;
          setThinking(false);
          thinkingRef.current = false;
          return;
        }
        playEngineMove(move);
      }
    };

    worker.onerror = () => {
      setEngineError("Не удалось загрузить Stockfish. Проверь, что файлы движка доступны.");
      setEngineReady(false);
      setThinking(false);
      thinkingRef.current = false;
    };

    worker.postMessage("uci");
    return () => {
      worker.postMessage("quit");
      worker.terminate();
      workerRef.current = null;
    };
  }, [playEngineMove]);

  const requestComputerMove = useCallback((positionFen) => {
    const worker = workerRef.current;
    if (!worker || !engineReady || thinkingRef.current) return;
    const level = LEVELS[difficulty];
    thinkingRef.current = true;
    setThinking(true);
    worker.postMessage("setoption name Skill Level value " + level.skill);
    worker.postMessage("position fen " + positionFen);
    worker.postMessage("go depth " + level.depth);
  }, [difficulty, engineReady]);

  const makeMove = useCallback((from, to, promotionPiece = "q") => {
    if (thinkingRef.current || finished) return false;
    const next = gameRef.current;
    try {
      next.move({ from, to, promotion: promotionPiece });
    } catch {
      return false;
    }
    syncPosition(next);
    setPromotion(null);
    if (!next.isGameOver()) {
      if (engineReady) {
        requestComputerMove(next.fen());
      }
    }
    return true;
  }, [engineReady, finished, requestComputerMove, syncPosition]);

  const onPieceDrop = useCallback(({ sourceSquare, targetSquare }) => {
    if (!sourceSquare || !targetSquare || thinkingRef.current || finished) return false;
    const current = gameRef.current;
    const piece = current.get(sourceSquare);
    if (!piece || piece.color !== "w" || current.turn() !== "w") return false;

    const reachesLastRank =
      piece.type === "p" &&
      ((piece.color === "w" && targetSquare[1] === "8") ||
        (piece.color === "b" && targetSquare[1] === "1"));

    if (reachesLastRank) {
      setPromotion({ from: sourceSquare, to: targetSquare });
      return false;
    }
    return makeMove(sourceSquare, targetSquare);
  }, [finished, makeMove]);

  const restart = () => {
    if (thinkingRef.current) {
      ignoreBestMoveRef.current = true;
      workerRef.current?.postMessage("stop");
    }
    thinkingRef.current = false;
    setThinking(false);
    setPromotion(null);
    setEngineError("");
    const fresh = new Chess();
    syncPosition(fresh);
  };

  const undo = () => {
    if (thinkingRef.current) {
      ignoreBestMoveRef.current = true;
      workerRef.current?.postMessage("stop");
      thinkingRef.current = false;
      setThinking(false);
    }
    const previous = gameRef.current;
    if (!previous.history().length) return;
    previous.undo();
    if (previous.turn() === "b" && previous.history().length) previous.undo();
    setPromotion(null);
    syncPosition(previous);
  };

  const changeDifficulty = (value) => {
    setDifficulty(value);
    if (thinkingRef.current) {
      workerRef.current?.postMessage("stop");
      thinkingRef.current = false;
      setThinking(false);
    }
  };

  const status = getStatus(game, thinking, engineReady);

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="./" aria-label="Boss Chess home">
          <span className="brand-mark">♞</span>
          <span>BOSS <strong>CHESS</strong></span>
        </a>
        <span className="topbar-note">ПЕРВЫЙ ЭТАП · КЛАССИЧЕСКИЕ ШАХМАТЫ</span>
      </header>

      <section className="game-layout">
        <div className="board-column">
          <div className="opponent-row">
            <div className="avatar avatar-dark">♟</div>
            <div className="opponent-copy">
              <strong>Компьютер</strong>
              <span>Stockfish 19 · играет чёрными</span>
            </div>
            <span className={"engine-indicator " + (engineReady ? "online" : "")}>
              {engineReady ? "ГОТОВ" : "ЗАГРУЗКА"}
            </span>
          </div>

          <div className="board-frame">
            <Chessboard
              options={{
                id: "boss-chess-board",
                position: fen,
                boardOrientation: "white",
                onPieceDrop,
                allowDragging: !thinking && !finished && !promotion,
                animationDurationInMs: 180,
                showNotation: true,
                darkSquareStyle: { backgroundColor: "#77916f" },
                lightSquareStyle: { backgroundColor: "#e8e5d8" },
                boardStyle: { borderRadius: "5px", overflow: "hidden" },
              }}
            />
          </div>

          <div className="player-row">
            <div className="avatar avatar-light">♙</div>
            <div className="opponent-copy">
              <strong>Ты</strong>
              <span>Белые фигуры</span>
            </div>
            <span className="player-tag">ИГРОК</span>
          </div>
        </div>

        <aside className="side-panel">
          <div className="panel-heading">
            <span className="eyebrow">ОДИНОЧНАЯ ИГРА</span>
            <h1>Шахматы</h1>
            <p className="status-line" aria-live="polite">{status}</p>
          </div>

          {promotion && (
            <div className="promotion-box">
              <strong>Выбери превращение пешки</strong>
              <div className="promotion-options">
                {[
                  ["q", "♕", "Ферзь"],
                  ["r", "♖", "Ладья"],
                  ["b", "♗", "Слон"],
                  ["n", "♘", "Конь"],
                ].map(([piece, symbol, label]) => (
                  <button
                    className="promotion-choice"
                    key={piece}
                    onClick={() => makeMove(promotion.from, promotion.to, piece)}
                    type="button"
                    aria-label={label}
                  >
                    <span>{symbol}</span>{label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="control-card">
            <label htmlFor="difficulty">Сложность компьютера</label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={(event) => changeDifficulty(event.target.value)}
              disabled={thinking}
            >
              {Object.entries(LEVELS).map(([key, level]) => (
                <option value={key} key={key}>{level.label}</option>
              ))}
            </select>
            <div className="button-row">
              <button className="button button-primary" onClick={restart} type="button">
                Новая партия
              </button>
              <button
                className="button button-secondary"
                onClick={undo}
                disabled={!history.length || thinking}
                type="button"
              >
                Отменить
              </button>
            </div>
          </div>

          <div className="moves-card">
            <div className="section-title">
              <strong>История ходов</strong>
              <span>{history.length} {history.length === 1 ? "ход" : "ходов"}</span>
            </div>
            {history.length === 0 ? (
              <p className="empty-history">Здесь появятся ходы партии.</p>
            ) : (
              <ol className="move-list">
                {Array.from({ length: Math.ceil(history.length / 2) }, (_, index) => (
                  <li key={index}>
                    <span className="move-number">{index + 1}.</span>
                    <span>{history[index * 2] || "—"}</span>
                    <span>{history[index * 2 + 1] || "…"}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {engineError && <p className="error-message">{engineError}</p>}
          <p className="small-note">
            Обычные шахматные правила. Пока без боссов и специальных способностей.
          </p>
        </aside>
      </section>

      <footer className="footer">
        <span>BOSS CHESS</span>
        <span>Сначала — крепкая шахматная основа.</span>
      </footer>
    </main>
  );
}