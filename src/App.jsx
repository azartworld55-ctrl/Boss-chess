import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, CircleHelp, Crown, RotateCcw, Settings2, Shield, Swords, Undo2, X } from "lucide-react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Toaster, toast } from "sonner";
import { DIFFICULTIES, useGameSettings } from "./store/useGameSettings.js";

const ENGINE_PATH = "stockfish/stockfish-19-lite-single.js";
const MotionDiv = motion.div;

function getGameStatus(game, thinking, ready) {
  if (game.isCheckmate()) return game.turn() === "w" ? "Мат. Победил компьютер." : "Мат! Ты победил.";
  if (game.isStalemate()) return "Пат — ничья.";
  if (game.isThreefoldRepetition()) return "Ничья: троекратное повторение.";
  if (game.isInsufficientMaterial()) return "Ничья: недостаточно фигур.";
  if (game.isDraw()) return "Ничья.";
  if (thinking) return "Компьютер обдумывает ход…";
  if (game.isCheck()) return "Шах! Твой ход.";
  if (!ready) return "Подключаем шахматный движок…";
  return "Твой ход. Играй белыми.";
}

function pairMoves(history) {
  return Array.from({ length: Math.ceil(history.length / 2) }, (_, index) => ({
    number: index + 1,
    white: history[index * 2],
    black: history[index * 2 + 1] || "…",
  }));
}

export default function App() {
  const [fen, setFen] = useState(() => new Chess().fen());
  const [history, setHistory] = useState([]);
  const [thinking, setThinking] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [engineError, setEngineError] = useState("");
  const [promotion, setPromotion] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const gameRef = useRef(new Chess());
  const workerRef = useRef(null);
  const thinkingRef = useRef(false);
  const readyRef = useRef(false);
  const activeSearchRef = useRef(false);
  const stoppingRef = useRef(false);
  const queuedFenRef = useRef(null);
  const difficultyRef = useRef("normal");

  const difficulty = useGameSettings((state) => state.difficulty);
  const setDifficulty = useGameSettings((state) => state.setDifficulty);
  const soundEnabled = useGameSettings((state) => state.soundEnabled);
  const setSoundEnabled = useGameSettings((state) => state.setSoundEnabled);
  difficultyRef.current = difficulty;

  const game = gameRef.current;
  const finished = game.isGameOver();
  const moves = useMemo(() => pairMoves(history), [history]);
  const status = getGameStatus(game, thinking, engineReady);

  const syncGame = useCallback((nextGame) => {
    gameRef.current = nextGame;
    setFen(nextGame.fen());
    setHistory(nextGame.history());
    setPromotion(null);
  }, []);

  const beginSearch = useCallback((positionFen) => {
    const worker = workerRef.current;
    if (!worker || !readyRef.current) {
      queuedFenRef.current = positionFen;
      thinkingRef.current = true;
      setThinking(true);
      return;
    }
    const level = DIFFICULTIES[difficultyRef.current] || DIFFICULTIES.normal;
    activeSearchRef.current = true;
    thinkingRef.current = true;
    setThinking(true);
    worker.postMessage("setoption name Skill Level value " + level.skill);
    worker.postMessage("position fen " + positionFen);
    worker.postMessage("go depth " + level.depth);
  }, []);

  const playMove = useCallback((from, to, promotionPiece = "q") => {
    if (thinkingRef.current || gameRef.current.isGameOver()) return false;
    const current = gameRef.current;
    try {
      current.move({ from, to, promotion: promotionPiece });
    } catch {
      return false;
    }
    syncGame(current);
    if (soundEnabled) toast.success("Ход выполнен", { duration: 850 });
    if (!current.isGameOver()) {
      if (stoppingRef.current) {
        queuedFenRef.current = current.fen();
        thinkingRef.current = true;
        setThinking(true);
      } else {
        beginSearch(current.fen());
      }
    } else {
      toast(current.isCheckmate() ? "Партия завершена: мат" : "Партия завершена");
    }
    return true;
  }, [beginSearch, soundEnabled, syncGame]);

  useEffect(() => {
    const worker = new Worker(new URL(ENGINE_PATH, document.baseURI));
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const message = String(event.data || "");
      if (message === "uciok") {
        worker.postMessage("isready");
      } else if (message === "readyok") {
        readyRef.current = true;
        setEngineReady(true);
        if (queuedFenRef.current && !stoppingRef.current) {
          const nextFen = queuedFenRef.current;
          queuedFenRef.current = null;
          beginSearch(nextFen);
        }
      } else if (message.startsWith("bestmove ")) {
        const uci = message.split(/\s+/)[1];
        if (stoppingRef.current) {
          stoppingRef.current = false;
          activeSearchRef.current = false;
          const queued = queuedFenRef.current;
          queuedFenRef.current = null;
          if (queued) beginSearch(queued);
          else {
            thinkingRef.current = false;
            setThinking(false);
          }
          return;
        }
        if (!activeSearchRef.current) return;
        activeSearchRef.current = false;
        thinkingRef.current = false;
        setThinking(false);
        if (!uci || uci === "(none)" || uci === "0000") return;
        const current = gameRef.current;
        try {
          current.move({
            from: uci.slice(0, 2),
            to: uci.slice(2, 4),
            ...(uci.length > 4 ? { promotion: uci[4].toLowerCase() } : {}),
          });
          syncGame(current);
        } catch {
          setEngineError("Движок вернул некорректный ход. Начни новую партию.");
        }
      }
    };

    worker.onerror = () => {
      readyRef.current = false;
      setEngineReady(false);
      thinkingRef.current = false;
      setThinking(false);
      setEngineError("Не удалось загрузить Stockfish. Обнови страницу и попробуй снова.");
    };

    worker.postMessage("uci");
    return () => {
      worker.postMessage("quit");
      worker.terminate();
      workerRef.current = null;
      readyRef.current = false;
    };
  }, [beginSearch, syncGame]);

  const cancelSearch = useCallback(() => {
    queuedFenRef.current = null;
    if (activeSearchRef.current && workerRef.current) {
      stoppingRef.current = true;
      workerRef.current.postMessage("stop");
    } else {
      stoppingRef.current = false;
      activeSearchRef.current = false;
    }
    thinkingRef.current = false;
    setThinking(false);
  }, []);

  const restart = () => {
    cancelSearch();
    syncGame(new Chess());
    setEngineError("");
    toast("Новая партия началась");
  };

  const undo = () => {
    if (!gameRef.current.history().length || thinkingRef.current) return;
    const current = gameRef.current;
    current.undo();
    if (current.turn() === "b" && current.history().length) current.undo();
    syncGame(current);
    toast("Ход отменён");
  };

  const onPieceDrop = ({ sourceSquare, targetSquare }) => {
    if (!sourceSquare || !targetSquare || thinkingRef.current || finished) return false;
    const piece = gameRef.current.get(sourceSquare);
    if (!piece || piece.color !== "w" || gameRef.current.turn() !== "w") return false;
    if (piece.type === "p" && targetSquare[1] === "8") {
      setPromotion({ from: sourceSquare, to: targetSquare });
      return false;
    }
    return playMove(sourceSquare, targetSquare);
  };

  const changeDifficulty = (value) => {
    setDifficulty(value);
    toast("Сложность сохранена");
  };

  return (
    <main className="app-shell">
      <Toaster position="top-center" theme="dark" richColors closeButton />
      <header className="app-header">
        <a className="brand" href="./" aria-label="Boss Chess — главная">
          <span className="brand-icon"><Crown size={21} strokeWidth={1.8} /></span>
          <span className="brand-name">BOSS<span>CHESS</span></span>
        </a>
        <div className="header-actions">
          <span className="version-pill">ВЕРСИЯ 2.0</span>
          <Dialog.Root open={settingsOpen} onOpenChange={setSettingsOpen}>
            <Dialog.Trigger asChild>
              <button className="icon-button" aria-label="Открыть настройки"><Settings2 size={19}/></button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="dialog-overlay"/>
              <Dialog.Content className="settings-dialog">
                <div className="dialog-heading">
                  <div><Dialog.Title>Настройки</Dialog.Title><Dialog.Description>Настрой игру под себя.</Dialog.Description></div>
                  <Dialog.Close asChild><button className="icon-button" aria-label="Закрыть"><X size={18}/></button></Dialog.Close>
                </div>
                <label className="setting-row">
                  <span><strong>Уведомления</strong><small>Сообщения о действиях в партии</small></span>
                  <input type="checkbox" checked={soundEnabled} onChange={(event) => setSoundEnabled(event.target.checked)}/>
                </label>
                <div className="setting-row">
                  <span><strong>Сложность</strong><small>Уровень игры компьютера</small></span>
                  <select aria-label="Уровень сложности игры" value={difficulty} onChange={(event) => changeDifficulty(event.target.value)}>
                    {Object.entries(DIFFICULTIES).map(([key, value]) => <option value={key} key={key}>{value.label}</option>)}
                  </select>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </header>

      <section className="game-layout">
        <div className="play-column">
          <div className="player-strip opponent-strip">
            <div className="player-avatar bot-avatar"><Shield size={20}/></div>
            <div className="player-meta"><strong>Компьютер</strong><span>Stockfish · чёрные</span></div>
            <span className={"connection-state " + (engineReady ? "is-ready" : "")}><i/>{engineReady ? "В сети" : "Загрузка"}</span>
          </div>

          <div className={"board-wrap " + (game.isCheck() ? "is-check" : "")}>
            <Chessboard options={{
              id: "boss-chess-v2",
              position: fen,
              boardOrientation: "white",
              onPieceDrop,
              allowDragging: !thinking && !finished && !promotion && engineReady,
              animationDurationInMs: 160,
              showNotation: true,
              darkSquareStyle: { backgroundColor: "#68866e" },
              lightSquareStyle: { backgroundColor: "#eeeadd" },
              boardStyle: { borderRadius: "8px", overflow: "hidden" },
            }}/>
            <AnimatePresence>
              {thinking && <MotionDiv className="thinking-overlay" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                <span className="thinking-dot"/><span>Компьютер думает</span>
              </MotionDiv>}
            </AnimatePresence>
          </div>

          <div className="player-strip human-strip">
            <div className="player-avatar human-avatar"><Swords size={19}/></div>
            <div className="player-meta"><strong>Ты</strong><span>Белые · играй первым</span></div>
            <span className="you-pill">ИГРОК</span>
          </div>

          <AnimatePresence>
            {promotion && <MotionDiv className="promotion-panel" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:8}}>
              <strong>Выбери фигуру для превращения</strong>
              <div className="promotion-grid">
                {[["q","♕","Ферзь"],["r","♖","Ладья"],["b","♗","Слон"],["n","♘","Конь"]].map(([piece,symbol,label]) =>
                  <button key={piece} onClick={() => playMove(promotion.from,promotion.to,piece)}><span>{symbol}</span>{label}</button>
                )}
              </div>
            </MotionDiv>}
          </AnimatePresence>
        </div>

        <aside className="game-sidebar">
          <section className="game-intro">
            <div className="section-kicker">ОДИНОЧНАЯ ИГРА</div>
            <h1>Твоя партия.</h1>
            <p className="game-status" aria-live="polite">{status}</p>
          </section>

          <section className="action-card">
            <div className="difficulty-heading"><span>Сложность</span><span className="difficulty-current">{DIFFICULTIES[difficulty].label}<ChevronDown size={13}/></span></div>
            <select className="difficulty-select" aria-label="Уровень сложности игры" value={difficulty} onChange={(event) => changeDifficulty(event.target.value)} disabled={thinking}>
              {Object.entries(DIFFICULTIES).map(([key, value]) => <option value={key} key={key}>{value.label}</option>)}
            </select>
            <div className="primary-actions">
              <button className="main-action" onClick={restart}><RotateCcw size={16}/>Новая партия</button>
              <button className="secondary-action" onClick={undo} disabled={!history.length || thinking} aria-label="Отменить ход"><Undo2 size={17}/></button>
            </div>
          </section>

          <section className="moves-card">
            <div className="moves-heading"><div><span className="section-kicker">ЗАПИСЬ ПАРТИИ</span><h2>Ходы</h2></div><span className="move-count">{history.length} полуход.</span></div>
            {moves.length === 0 ? <div className="empty-moves"><CircleHelp size={20}/><span>Сделай первый ход,<br/>чтобы начать партию.</span></div> :
              <ol className="move-history">
                {moves.map((move) => <motion.li key={move.number} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: "easeOut" }}>
                  <span className="move-index">{move.number.toString().padStart(2,"0")}</span>
                  <span>{move.white}</span><span>{move.black}</span>
                </li>)}
              </ol>}
          </section>
          {engineError && <div className="error-banner" role="alert">{engineError}</div>}
          <div className="sidebar-footnote"><Shield size={14}/><span>Классические шахматы. Боссов и особых способностей пока нет.</span></div>
        </aside>
      </section>

      <footer className="app-footer"><span>BOSS CHESS <b>2.0</b></span><span>Сделано для шахмат.</span></footer>
    </main>
  );
}
