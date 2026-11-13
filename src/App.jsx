import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft, ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight,
  Crown, List, Play, RotateCcw, Settings2, SlidersHorizontal,
  Undo2, Check
} from "lucide-react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { Toaster } from "sonner";
import { useGameSettings } from "./store/useGameSettings.js";

const BOARD_THEMES = {
  classic: { light: "#e8deca", dark: "#698777" },
  green: { light: "#edf0d2", dark: "#7b9b60" },
  blue: { light: "#e2e6e8", dark: "#8fa4ad" },
};

const ENGINE_PATH = "stockfish/stockfish-19-lite-single.js";
const MotionDiv = motion.div;
const PIECES = [["q", "♕", "Ферзь"], ["r", "♖", "Ладья"], ["b", "♗", "Слон"], ["n", "♘", "Конь"]];

function getStatus(game, thinking, ready, humanColor) {
  if (game.isCheckmate()) return game.turn() === humanColor ? "Мат. Победил компьютер." : "Мат! Ты победил.";
  if (game.isStalemate() || game.isDraw()) return "Партия завершилась вничью.";
  if (thinking) return "Stockfish обдумывает ход";
  if (!ready) return "Подключаем Stockfish…";
  if (game.isCheck()) return "Шах вашему королю";
  return game.turn() === humanColor ? "Ваш ход" : "Ход компьютера";
}
function pairMoves(history) {
  return Array.from({ length: Math.ceil(history.length / 2) }, (_, i) => ({
    number: i + 1, white: history[i * 2], black: history[i * 2 + 1] || "—",
  }));
}

export default function App() {
  const [fen, setFen] = useState(() => new Chess().fen());
  const [history, setHistory] = useState([]);
  const [thinking, setThinking] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [engineError, setEngineError] = useState("");
  const [promotion, setPromotion] = useState(null);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [screen, setScreen] = useState("home");
  const [settingsReturn, setSettingsReturn] = useState("home");
  const [humanColor, setHumanColor] = useState("w");
  const [chosenSide, setChosenSide] = useState("w");
  const [reviewPly, setReviewPly] = useState(null);

  const gameRef = useRef(new Chess());
  const workerRef = useRef(null);
  const thinkingRef = useRef(false);
  const readyRef = useRef(false);
  const activeSearchRef = useRef(false);
  const stoppingRef = useRef(false);
  const queuedFenRef = useRef(null);
  const eloRef = useRef(1800);
  const humanColorRef = useRef("w");

  const elo = useGameSettings((s) => s.elo);
  const setElo = useGameSettings((s) => s.setElo);
  const boardTheme = useGameSettings((s) => s.boardTheme);
  const setBoardTheme = useGameSettings((s) => s.setBoardTheme);
  const soundEnabled = useGameSettings((s) => s.soundEnabled);
  const setSoundEnabled = useGameSettings((s) => s.setSoundEnabled);
  const animationsEnabled = useGameSettings((s) => s.animationsEnabled);
  const setAnimationsEnabled = useGameSettings((s) => s.setAnimationsEnabled);
  const hintsEnabled = useGameSettings((s) => s.hintsEnabled);
  const setHintsEnabled = useGameSettings((s) => s.setHintsEnabled);
  const lastMoveEnabled = useGameSettings((s) => s.lastMoveEnabled);
  const setLastMoveEnabled = useGameSettings((s) => s.setLastMoveEnabled);
  const coordinatesEnabled = useGameSettings((s) => s.coordinatesEnabled);
  const setCoordinatesEnabled = useGameSettings((s) => s.setCoordinatesEnabled);
  eloRef.current = elo;
  humanColorRef.current = humanColor;

  const game = gameRef.current;
  const finished = game.isGameOver();
  const moves = useMemo(() => pairMoves(history), [history]);
  const status = getStatus(game, thinking, engineReady, humanColor);
  const displayedGame = useMemo(() => {
    if (reviewPly === null) return null;
    const replay = new Chess();
    history.slice(0, reviewPly).forEach((san) => { try { replay.move(san); } catch { /* ignore invalid historic entry */ } });
    return replay.fen();
  }, [history, reviewPly]);

  const syncGame = useCallback((nextGame) => {
    gameRef.current = nextGame;
    setFen(nextGame.fen());
    setHistory(nextGame.history());
    setPromotion(null);
    setSelectedSquare(null);
    setReviewPly(null);
  }, []);

  const beginSearch = useCallback((positionFen) => {
    const worker = workerRef.current;
    if (!worker || !readyRef.current) {
      queuedFenRef.current = positionFen;
      thinkingRef.current = true;
      setThinking(true);
      return;
    }
    const rating = Math.max(1320, Math.min(3190, eloRef.current || 1800));
    activeSearchRef.current = true;
    thinkingRef.current = true;
    setThinking(true);
    worker.postMessage("setoption name UCI_LimitStrength value true");
    worker.postMessage("setoption name UCI_Elo value " + rating);
    worker.postMessage("position fen " + positionFen);
    worker.postMessage("go depth 18");
  }, []);

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

  const playMove = useCallback((from, to, promotionPiece = "q") => {
    if (thinkingRef.current || gameRef.current.isGameOver() || gameRef.current.turn() !== humanColorRef.current) return false;
    const current = gameRef.current;
    try { current.move({ from, to, promotion: promotionPiece }); } catch { return false; }
    syncGame(current);
    if (!current.isGameOver()) beginSearch(current.fen());
    return true;
  }, [beginSearch, syncGame]);

  useEffect(() => {
    const worker = new Worker(new URL(ENGINE_PATH, document.baseURI));
    workerRef.current = worker;
    worker.onmessage = (event) => {
      const message = String(event.data || "");
      if (message === "uciok") worker.postMessage("isready");
      else if (message === "readyok") {
        readyRef.current = true;
        setEngineReady(true);
        if (queuedFenRef.current && !stoppingRef.current) {
          const nextFen = queuedFenRef.current; queuedFenRef.current = null; beginSearch(nextFen);
        }
      } else if (message.startsWith("bestmove ")) {
        const uci = message.split(/\s+/)[1];
        if (stoppingRef.current) {
          stoppingRef.current = false; activeSearchRef.current = false;
          const queued = queuedFenRef.current; queuedFenRef.current = null;
          if (queued) beginSearch(queued);
          else { thinkingRef.current = false; setThinking(false); }
          return;
        }
        if (!activeSearchRef.current) return;
        activeSearchRef.current = false; thinkingRef.current = false; setThinking(false);
        if (!uci || uci === "(none)" || uci === "0000") return;
        const current = gameRef.current;
        try {
          current.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci.length > 4 ? { promotion: uci[4].toLowerCase() } : {}) });
          syncGame(current);
        } catch { setEngineError("Stockfish вернул некорректный ход. Начните новую партию."); }
      }
    };
    worker.onerror = () => {
      readyRef.current = false; setEngineReady(false); thinkingRef.current = false; setThinking(false);
      setEngineError("Не удалось загрузить Stockfish. Обновите страницу и попробуйте снова.");
    };
    worker.postMessage("uci");
    return () => { worker.postMessage("quit"); worker.terminate(); workerRef.current = null; readyRef.current = false; };
  }, [beginSearch, syncGame]);

  const startGame = (side = chosenSide) => {
    const color = side === "random" ? (Math.random() < 0.5 ? "w" : "b") : side;
    cancelSearch();
    setHumanColor(color);
    humanColorRef.current = color;
    const fresh = new Chess();
    syncGame(fresh);
    setEngineError("");
    setReviewPly(null);
    setScreen("game");
    if (color === "b") {
      if (stoppingRef.current) queuedFenRef.current = fresh.fen();
      else beginSearch(fresh.fen());
    }
  };
  const restart = () => startGame(humanColor);
  const undo = () => {
    if (!gameRef.current.history().length || thinkingRef.current) return;
    const current = gameRef.current;
    current.undo();
    if (current.history().length && current.turn() !== humanColorRef.current) current.undo();
    syncGame(current);
  };
  const onPieceDrop = ({ sourceSquare, targetSquare }) => {
    if (!sourceSquare || !targetSquare || thinking || finished || game.turn() !== humanColor) return false;
    const piece = game.get(sourceSquare);
    if (!piece || piece.color !== humanColor) return false;
    const lastRank = humanColor === "w" ? "8" : "1";
    if (piece.type === "p" && targetSquare[1] === lastRank) { setPromotion({ from: sourceSquare, to: targetSquare }); return false; }
    return playMove(sourceSquare, targetSquare);
  };
  const changeElo = (value) => setElo(value);
  const openReview = (ply) => { setReviewPly(ply); setScreen("review"); };
  const openSettings = () => { setSettingsReturn(screen); setScreen("settings"); };
  const boardPosition = screen === "review" ? displayedGame || fen : fen;
  const playerLabel = humanColor === "w" ? "Белые" : "Чёрные";
  const sideLabel = humanColor === "w" ? "Белые" : "Чёрные";

  const handleSquareClick = ({ square }) => {
    if (screen !== "game" || !hintsEnabled || thinking || finished || game.turn() !== humanColor) return;
    if (selectedSquare) {
      const legal = game.moves({ square: selectedSquare, verbose: true });
      if (legal.some((move) => move.to === square)) {
        const movingPiece = game.get(selectedSquare);
        const lastRank = humanColor === "w" ? "8" : "1";
        if (movingPiece?.type === "p" && square[1] === lastRank) setPromotion({ from: selectedSquare, to: square });
        else playMove(selectedSquare, square);
        setSelectedSquare(null);
        return;
      }
    }
    const clickedPiece = game.get(square);
    if (clickedPiece?.color === humanColor) setSelectedSquare(square);
    else setSelectedSquare(null);
  };
  const renderBoard = (compact = false) => {
    const palette = BOARD_THEMES[boardTheme] || BOARD_THEMES.classic;
    const squareStyles = {};
    if (!compact && screen === "game") {
      if (lastMoveEnabled) {
        const lastMove = game.history({ verbose: true }).at(-1);
        if (lastMove) {
          squareStyles[lastMove.from] = { backgroundColor: "#dca83f55" };
          squareStyles[lastMove.to] = { backgroundColor: "#dca83f77" };
        }
      }
      if (selectedSquare) squareStyles[selectedSquare] = { backgroundColor: "#e5bd5b99", boxShadow: "inset 0 0 0 3px #f0ca70" };
      if (selectedSquare && hintsEnabled) {
        game.moves({ square: selectedSquare, verbose: true }).forEach((move) => {
          squareStyles[move.to] = { background: game.get(move.to) ? "radial-gradient(transparent 54%, #dca83f88 56%)" : "radial-gradient(#dca83f88 18%, transparent 20%)" };
        });
      }
    }
    return (
    <div className="board-frame">
      <Chessboard options={{
        id: compact ? "boss-chess-home" : "boss-chess-live",
        position: compact ? new Chess().fen() : boardPosition,
        boardOrientation: humanColor === "w" ? "white" : "black",
        onPieceDrop: compact || screen !== "game" ? undefined : onPieceDrop,
        allowDragging: !compact && screen === "game" && !thinking && !finished && !promotion && engineReady && game.turn() === humanColor,
        animationDurationInMs: 190,
        showAnimations: animationsEnabled,
        squareStyles,
        onSquareClick: compact ? undefined : handleSquareClick,
        showNotation: coordinatesEnabled,
        darkSquareStyle: { backgroundColor: palette.dark },
        lightSquareStyle: { backgroundColor: palette.light },
        boardStyle: { borderRadius: "13px", overflow: "hidden" },
      }} />
      {screen === "game" && thinking && <div className="thinking-chip"><span className="thinking-dot"/> Stockfish думает</div>}
    </div>
    );
  };

  return (
    <main className="app-shell">
      <Toaster position="top-center" theme="dark" />
      <header className="topbar">
        <button className="wordmark" onClick={() => setScreen("home")} aria-label="Главное меню">
          <span className="brand-crown"><Crown size={19}/></span><span>BOSS <b>CHESS</b></span>
        </button>
        <button className="header-settings" onClick={openSettings} aria-label="Настройки"><SlidersHorizontal size={20}/></button>
      </header>

      <AnimatePresence mode="wait">
        {screen === "home" && <MotionDiv className="screen home-screen" key="home" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}>
          <div className="home-heading"><div><span className="eyebrow">ШАХМАТЫ ПРОТИВ ИИ</span><h1>Boss Chess</h1><p>Продумайте каждый ход.</p></div><button className="round-icon" onClick={() => setScreen("settings")} aria-label="Настройки"><Settings2/></button></div>
          <div className="home-board">{renderBoard(true)}</div>
          <div className="home-actions">
            {history.length > 0 && <button className="continue-card" onClick={() => setScreen("game")}><span className="continue-icon"><Play size={21} fill="currentColor"/></span><span><strong>Продолжить партию</strong><small>Вы — {playerLabel.toLowerCase()} · ход {Math.floor(history.length / 2) + 1} · {elo} Elo</small></span><ChevronRight className="continue-arrow"/></button>}
            <button className="new-game-button" onClick={() => { setChosenSide("w"); setScreen("new"); }}>Новая партия <ChevronRight size={19}/></button>
          </div>
        </MotionDiv>}

        {screen === "new" && <MotionDiv className="screen sub-screen" key="new" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
          <ScreenTitle title="Новая партия" onBack={() => setScreen("home")}/>
          <section className="form-section"><h2>ВАША СТОРОНА</h2><div className="side-options">
            {[["w","♔","Белые"],["b","♚","Чёрные"],["random","?","Случайно"]].map(([value,symbol,label]) => <button key={value} className={"side-option "+(chosenSide===value?"selected":"")} onClick={() => setChosenSide(value)}><span>{symbol}</span><b>{label}</b>{chosenSide===value && <i><Check size={13}/></i>}</button>)}
          </div></section>
          <DifficultyControl elo={elo} onChange={changeElo}/>
          <div className="bottom-actions"><button className="gold-button" onClick={() => startGame(chosenSide)}>Начать партию</button>{history.length > 0 && <button className="text-button" onClick={() => setScreen("game")}>Вернуться к текущей партии</button>}</div>
        </MotionDiv>}

        {screen === "game" && <MotionDiv className="screen game-screen" key="game" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
          <div className="game-topline"><button className="round-icon" onClick={() => setScreen("home")} aria-label="В меню"><ArrowLeft/></button><div className="game-title"><span className="eyebrow">BOSS CHESS</span><strong>Партия</strong></div><button className="round-icon" onClick={() => setScreen("settings")} aria-label="Настройки"><Settings2/></button></div>
          <PlayerBar name="Stockfish" subtitle="Компьютер" avatar="SF" active={thinking || (game.turn() !== humanColor && !finished)} right={<span className="elo-chip">{elo} Elo</span>}/>
          {renderBoard()}
          <PlayerBar name="Вы" subtitle={sideLabel} avatar="ВЫ" active={game.turn() === humanColor && !finished} right={<span className={"turn-pill "+(game.turn()===humanColor&&!finished?"active":"")}>{finished ? "Партия завершена" : game.turn()===humanColor ? "Ваш ход" : thinking ? "Ход ИИ" : "Ожидание"}</span>}/>
          {game.isCheck() && !finished && <div className="check-notice"><span/> Шах вашему королю</div>}
          {engineError && <div className="error-banner">{engineError}</div>}
          <div className="notation-strip">{moves.length ? moves.slice(-3).map((m)=><span key={m.number}><b>{m.number}.</b> {m.white} <em>{m.black}</em></span>) : <span className="muted">Сделайте первый ход, чтобы начать партию</span>}</div>
          <div className="game-controls">
            <button onClick={undo} disabled={!history.length || thinking}><Undo2/><span>Отмена</span></button>
            <button onClick={restart}><RotateCcw/><span>Заново</span></button>
            <button onClick={() => setScreen("history")}><List/><span>История</span></button>
            <button onClick={() => setScreen("settings")}><SlidersHorizontal/><span>Настройки</span></button>
          </div>
          {finished && <section className="result-card"><span className="eyebrow">КОНЕЦ ПАРТИИ</span><h2>{game.isCheckmate() ? (game.turn()===humanColor?"Мат":"Победа") : "Ничья"}</h2><p>{status}</p><div><button className="outline-button" onClick={() => setScreen("home")}>В меню</button><button className="gold-button" onClick={restart}>Реванш</button></div></section>}
          {promotion && <div className="promotion-panel"><h2>ВО ЧТО ПРЕВРАТИТЬ ПЕШКУ</h2><div>{PIECES.map(([piece,symbol,label])=><button key={piece} onClick={()=>playMove(promotion.from,promotion.to,piece)}><span>{symbol}</span>{label}</button>)}</div></div>}
        </MotionDiv>}

        {screen === "history" && <MotionDiv className="screen sub-screen" key="history" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
          <ScreenTitle title="История ходов" onBack={() => setScreen("game")}/>
          {moves.length ? <div className="history-list">{moves.map((m,i)=><button key={m.number} className={(reviewPly===i*2+2?"current":"")} onClick={() => openReview(i*2+2)}><span>{m.number}</span><b>{m.white}</b><b>{m.black}</b></button>)}</div> : <p className="empty-state">Здесь появятся ходы вашей партии.</p>}
          <p className="helper-text">Выберите ход, чтобы посмотреть позицию. Продолжить игру можно только из текущей позиции.</p>
          <div className="bottom-actions"><button className="gold-button" onClick={() => setScreen("game")}>К партии</button></div>
        </MotionDiv>}

        {screen === "review" && <MotionDiv className="screen game-screen" key="review" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
          <ScreenTitle title="Просмотр партии" onBack={() => setScreen("history")}/>
          <PlayerBar name="Stockfish" subtitle="Компьютер" avatar="SF"/>
          <div className="board-frame"><Chessboard options={{id:"boss-chess-review",position:displayedGame||fen,boardOrientation:humanColor==="w"?"white":"black",allowDragging:false,animationDurationInMs:0,showNotation:coordinatesEnabled,darkSquareStyle:{backgroundColor:(BOARD_THEMES[boardTheme]||BOARD_THEMES.classic).dark},lightSquareStyle:{backgroundColor:(BOARD_THEMES[boardTheme]||BOARD_THEMES.classic).light},boardStyle:{borderRadius:"13px",overflow:"hidden"}}}/></div>
          <PlayerBar name="Вы" subtitle={sideLabel} avatar="ВЫ"/>
          <div className="review-controls"><button onClick={()=>setReviewPly(0)}><ChevronsLeft/></button><button onClick={()=>setReviewPly(Math.max(0,(reviewPly||0)-1))}><ArrowLeft/></button><button onClick={()=>setReviewPly(Math.min(history.length,(reviewPly||0)+1))}><ChevronRight/></button><button onClick={()=>setReviewPly(history.length)}><ChevronsRight/></button></div>
          <div className="bottom-actions"><button className="gold-button" onClick={()=>setScreen("game")}>Вернуться к партии</button></div>
        </MotionDiv>}

        {screen === "settings" && <MotionDiv className="screen sub-screen" key="settings" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
          <ScreenTitle title="Настройки" onBack={() => setScreen(settingsReturn)}/>
          <DifficultyControl elo={elo} onChange={changeElo}/>
          <section className="settings-group"><h2>ПОДСКАЗКИ НА ДОСКЕ</h2><SettingToggle label="Возможные ходы" checked={hintsEnabled} onChange={setHintsEnabled}/><SettingToggle label="Последний ход" checked={lastMoveEnabled} onChange={setLastMoveEnabled}/><SettingToggle label="Координаты клеток" checked={coordinatesEnabled} onChange={setCoordinatesEnabled}/></section>
          <section className="settings-group"><h2>ОБЩЕЕ</h2><SettingToggle label="Звуки" checked={soundEnabled} onChange={setSoundEnabled}/><SettingToggle label="Анимации" checked={animationsEnabled} onChange={setAnimationsEnabled}/></section>
          <section className="settings-group"><h2>ЦВЕТ ДОСКИ</h2><div className="board-themes">{[["classic","Классическая"],["green","Зелёная"],["blue","Синяя"]].map(([key,label])=><button key={key} className={"theme-swatch "+key+(boardTheme===key?" selected":"")} aria-label={label} aria-pressed={boardTheme===key} onClick={()=>setBoardTheme(key)}/>)}</div></section>
          <p className="helper-text">Настройки сохраняются на этом устройстве.</p>
        </MotionDiv>}
      </AnimatePresence>
    </main>
  );
}

function ScreenTitle({title,onBack}) {
  return <div className="screen-title"><button className="round-icon" onClick={onBack} aria-label="Назад"><ArrowLeft/></button><h1>{title}</h1></div>;
}
function PlayerBar({name,subtitle,avatar,active,right}) {
  return <div className="player-bar"><div className="player-avatar">{avatar==="SF"?<span>SF</span>:<span>{avatar}</span>}</div><div className="player-info"><strong>{name}</strong><small>{subtitle}</small></div>{right || (active?<span className="active-dot"/>:null)}</div>;
}
function DifficultyControl({elo,onChange}) {
  const presets=[1400,1800,2200,2600,3000];
  return <section className="difficulty-section"><h2>СИЛА STOCKFISH</h2><div className="difficulty-panel"><div className="difficulty-value"><strong>{elo}</strong><span>Elo</span><small>Ограничение силы движка</small></div><input aria-label="Рейтинг Stockfish Elo" type="range" min="1320" max="3190" step="10" value={elo} onChange={e=>onChange(Number(e.target.value))}/><div className="range-labels"><span>1320</span><span>3190</span></div><div className="elo-number"><label htmlFor="elo-number">Точное значение</label><input id="elo-number" type="number" min="1320" max="3190" step="10" value={elo} onChange={e=>onChange(Number(e.target.value))}/></div><div className="difficulty-presets">{presets.map(value=><button key={value} className={elo===value?"selected":""} onClick={()=>onChange(value)}>{value}</button>)}</div></div></section>;
}
function SettingToggle({label,checked,onChange}) {
  return <label className="setting-toggle"><span>{label}</span><input type="checkbox" checked={Boolean(checked)} onChange={e=>onChange(e.target.checked)}/><i/></label>;
}
