import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion as Motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Crown, Sparkles } from "lucide-react";
import { Chessboard } from "react-chessboard";
import { BOSS_PIECES } from "../components/BossPieces.jsx";
import { applyCampaignMove, campaignFen, campaignMoves, choosePawnBossMove, createPawnCampaign } from "./pawnCampaign.js";

const BOSS_ART = import.meta.env.BASE_URL + "images/bosses/peshok.svg";

export default function CampaignScreen({ onExit }) {
  const [state, setState] = useState(() => createPawnCampaign());
  const [thinkingBoss, setThinkingBoss] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showIntro, setShowIntro] = useState(false);
  const reduceMotion = useReducedMotion();
  const fen = useMemo(() => campaignFen(state), [state]);
  const legalFrom = useMemo(() => selected ? campaignMoves(state, selected).map((move) => move.to) : [], [state, selected]);

  const move = (from, to) => {
    const result = applyCampaignMove(state, from, to);
    if (!result.move) return false;
    setState(result.state);
    setSelected(null);
    if (result.state.bossRevealed && !state.bossRevealed) setShowIntro(true);
    return true;
  };

  useEffect(() => {
    if (state.turn !== "b" || state.result || showIntro) return undefined;
    setThinkingBoss(true);
    const timer = window.setTimeout(() => {
      const choice = choosePawnBossMove(state);
      if (choice) {
        const result = applyCampaignMove(state, choice.from, choice.to);
        setState(result.state);
      }
      setThinkingBoss(false);
    }, 520);
    return () => window.clearTimeout(timer);
  }, [state, showIntro]);

  const onDrop = ({ sourceSquare, targetSquare }) => {
    if (!sourceSquare || !targetSquare || state.turn !== "w" || state.result || thinkingBoss || showIntro) return false;
    return move(sourceSquare, targetSquare);
  };
  const onSquare = ({ square }) => {
    if (state.turn !== "w" || state.result || thinkingBoss || showIntro) return;
    if (selected && legalFrom.includes(square)) { move(selected, square); return; }
    const piece = state.board[8-Number(square[1])][square.charCodeAt(0)-97];
    setSelected(piece && piece === piece.toUpperCase() ? square : null);
  };
  const squareStyles = {};
  if (selected) squareStyles[selected] = { backgroundColor: "#e5bd5b99", boxShadow: "inset 0 0 0 3px #f0ca70" };
  legalFrom.forEach((sq) => { squareStyles[sq] = { background: "radial-gradient(#dca83f99 18%, transparent 20%)" }; });

  return (
    <Motion.div className="screen campaign-screen" initial={reduceMotion ? false : {opacity:0,y:14}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
      <div className="game-topline">
        <button className="round-icon" onClick={onExit} aria-label="В меню"><ArrowLeft/></button>
        <div className="game-title"><span className="eyebrow">ГЛАВА 01 · КЛАССИКА</span><strong>Испытание пешечной гвардии</strong></div>
        <span className="campaign-chapter-mark">I</span>
      </div>

      <section className={"campaign-opponent " + (state.bossRevealed ? "is-revealed" : "is-hidden")}>
        <div className="boss-portrait-shell">
          {state.bossRevealed ? <img src={BOSS_ART} alt="Босс Пешок — командир пешечной гвардии" loading="eager" decoding="async"/> : <div className="campaign-unknown"><Crown size={26}/><span>?</span></div>}
        </div>
        <div className="campaign-opponent-copy">
          <span className="eyebrow">ПРОТИВНИК · ГЛАВА 01</span>
          <strong>{state.bossRevealed ? "Пешок" : "Личность скрыта"}</strong>
          <small>{state.bossRevealed ? "Командир чёрной пешечной гвардии" : "Сначала докажи, что достоин его внимания."}</small>
        </div>
        <div className="campaign-counter"><b>{8-state.bossPawnsLeft}<i>/8</i></b><small>пешек повержено</small></div>
      </section>

      <div className="campaign-board-shell">
        <div className="campaign-board-ornament"><span>БОЕВОЕ ПОЛЕ</span><span>ХОД {Math.floor(state.history.length / 2) + 1}</span></div>
        <div className="board-frame campaign-board"><Chessboard options={{id:"boss-campaign-board",pieces:BOSS_PIECES,position:fen,boardOrientation:"white",onPieceDrop:onDrop,onSquareClick:onSquare,allowDragging:state.turn==="w"&&!state.result&&!thinkingBoss&&!showIntro,canDragPiece:({square})=>{const p=state.board[8-Number(square[1])][square.charCodeAt(0)-97];return state.turn==="w"&&!state.result&&!thinkingBoss&&!showIntro&&p===p?.toUpperCase();},squareStyles,animationDurationInMs:240,showAnimations:!reduceMotion,showNotation:true,darkSquareStyle:{backgroundColor:"#3e5954"},lightSquareStyle:{backgroundColor:"#ead9b7"},boardStyle:{borderRadius:"8px",overflow:"hidden"}}}/></div>
      </div>

      <div className="campaign-status">
        <span className={"campaign-status-orb " + (thinkingBoss ? "is-thinking" : "")}/>
        {state.result==="win" ? "Победа! Пешечная гвардия повержена." : state.result==="loss" ? "Пешок удержал поле. Попробуй ещё раз." : thinkingBoss ? "Пешок отдаёт приказ…" : showIntro ? "Первый боец повержен. Командир вышел на поле." : state.turn==="w" ? "Твой ход — найди слабое звено." : "Ход пешечной гвардии"}
      </div>

      {state.bossRevealed && <details className="campaign-rules"><summary>Тактика Пешка</summary><span>Пешка, взявшая твою фигуру, немедленно превращается в ферзя.</span><span>Король босса, достигший твоей последней горизонтали, становится ферзём.</span><span>Победа — после уничтожения всех восьми пешек.</span></details>}
      {state.result && <div className="result-card"><span className="eyebrow">ГЛАВА 01 · ИТОГ</span><h2>{state.result==="win"?"Победа":"Партия завершена"}</h2><p>{state.result==="win"?"Пешечная гвардия больше не держит оборону.":"Пешок удержал поле в этой попытке."}</p><button className="gold-button" onClick={()=>{setState(createPawnCampaign());setShowIntro(false);}}>Повторить битву</button></div>}

      <p className="campaign-footnote">В кампании нет шаха и мата. Короля можно взять; сражение продолжается, пока на доске остаются пешки босса.</p>

      {createPortal(<AnimatePresence>
        {showIntro && <Motion.div className="campaign-intro" role="dialog" aria-modal="true" aria-labelledby="boss-reveal-title" initial={reduceMotion ? {opacity:1} : {opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:reduceMotion ? 0 : .32}}>
          <div className="boss-reveal-stars" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
          <div className="boss-reveal-stage">
            <div className="boss-reveal-ring"/>
            <Motion.img className="boss-reveal-art" src={BOSS_ART} alt="Пешок, командир пешечной гвардии" initial={reduceMotion ? false : {opacity:0,y:50,scale:.72,rotate:-7}} animate={{opacity:1,y:0,scale:1,rotate:0}} transition={{duration:reduceMotion ? 0 : .75,ease:[.16,1,.3,1],delay:reduceMotion ? 0 : .12}}/>
          </div>
          <div className="boss-reveal-copy">
            <span className="boss-reveal-kicker"><Sparkles size={15}/> ПЕРВЫЙ БОСС · ГЛАВА 01</span>
            <h2 id="boss-reveal-title">ПЕШОК</h2>
            <strong>КОМАНДИР ЧЁРНОЙ ГВАРДИИ</strong>
            <p>«Ты забрал одного из моих бойцов. Теперь посмотрим, сможешь ли пройти через остальных».</p>
            <button className="gold-button" onClick={()=>setShowIntro(false)}>ВСТУПИТЬ В БОЙ <ArrowLeft size={17}/></button>
          </div>
        </Motion.div>}
      </AnimatePresence>, document.body)}
    </Motion.div>
  );
}
