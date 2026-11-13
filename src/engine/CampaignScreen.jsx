import { useEffect, useMemo, useState } from "react";
import { motion as Motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { Chessboard } from "react-chessboard";
import { applyCampaignMove, campaignFen, campaignMoves, choosePawnBossMove, createPawnCampaign } from "./pawnCampaign.js";

export default function CampaignScreen({ onExit }) {
  const [state, setState] = useState(() => createPawnCampaign());
  const [thinkingBoss, setThinkingBoss] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showIntro, setShowIntro] = useState(false);
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
    if (state.turn !== "b" || state.result) return undefined;
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
  }, [state]);
  const onDrop = ({ sourceSquare, targetSquare }) => {
    if (!sourceSquare || !targetSquare || state.turn !== "w" || state.result || thinkingBoss) return false;
    return move(sourceSquare, targetSquare);
  };
  const onSquare = ({ square }) => {
    if (state.turn !== "w" || state.result || thinkingBoss) return;
    if (selected && legalFrom.includes(square)) { move(selected, square); return; }
    const piece = state.board[8-Number(square[1])][square.charCodeAt(0)-97];
    setSelected(piece && piece === piece.toUpperCase() ? square : null);
  };
  const squareStyles = {};
  if (selected) squareStyles[selected] = { backgroundColor: "#e5bd5b99", boxShadow: "inset 0 0 0 3px #f0ca70" };
  legalFrom.forEach((sq) => { squareStyles[sq] = { background: "radial-gradient(#dca83f99 18%, transparent 20%)" }; });
  return (
    <Motion.div className="screen campaign-screen" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
      <div className="game-topline"><button className="round-icon" onClick={onExit} aria-label="В меню"><ArrowLeft/></button><div className="game-title"><span className="eyebrow">ГЛАВА 1 · КЛАССИКА</span><strong>Кампания</strong></div></div>
      <div className="campaign-opponent">
        {state.bossRevealed ? <img src={import.meta.env.BASE_URL + "images/bosses/pawn.webp"} alt="Портрет босса Пешка"/> : <div className="campaign-unknown">?</div>}
        <div><span className="eyebrow">ПРОТИВНИК</span><strong>{state.bossRevealed ? "Пешка" : "Неизвестный соперник"}</strong><small>{state.bossRevealed ? "Не недооценивай маленькие фигуры." : "Обычная партия. Пока что."}</small></div>
        <div className="campaign-counter"><b>{8-state.bossPawnsLeft}/8</b><small>пешек побеждено</small></div>
      </div>
      <div className="board-frame campaign-board"><Chessboard options={{id:"boss-campaign-board",position:fen,boardOrientation:"white",onPieceDrop:onDrop,onSquareClick:onSquare,allowDragging:state.turn==="w"&&!state.result&&!thinkingBoss,canDragPiece:({square})=>{const p=state.board[8-Number(square[1])][square.charCodeAt(0)-97];return state.turn==="w"&&!state.result&&!thinkingBoss&&p===p?.toUpperCase();},squareStyles,animationDurationInMs:180,showAnimations:true,showNotation:true,darkSquareStyle:{backgroundColor:"#698777"},lightSquareStyle:{backgroundColor:"#e8deca"},boardStyle:{borderRadius:"13px",overflow:"hidden"}}}/></div>
      <div className="campaign-status">{state.result==="win" ? "Победа! Все пешки босса уничтожены." : state.result==="loss" ? "У босса больше нет доступных ходов." : thinkingBoss ? "Пешка обдумывает ход…" : state.turn==="w" ? "Ваш ход" : "Ход Пешки"}</div>
      {state.bossRevealed && <div className="campaign-rules"><b>Способности Пешки</b><span>Пешка, взявшая вашу фигуру, превращается в ферзя.</span><span>Король босса, достигший вашей последней горизонтали, становится ферзём.</span><span>Победа — после уничтожения всех восьми пешек.</span></div>}
      {state.result && <div className="result-card"><span className="eyebrow">ГЛАВА 1 · ИТОГ</span><h2>{state.result==="win"?"Победа":"Партия завершена"}</h2><p>{state.result==="win"?"Пешки больше не защищают своего босса.":"В этой попытке продолжить сражение не удалось."}</p><button className="gold-button" onClick={()=>setState(createPawnCampaign())}>Повторить битву</button></div>}
      {showIntro && <div className="campaign-intro"><div><img src={import.meta.env.BASE_URL + "images/bosses/pawn.webp"} alt="Пешка"/><div><span className="eyebrow">ПЕРВЫЙ БОСС</span><h2>Пешка</h2></div></div><p>Ты решила начать с самых маленьких? Тогда посмотрим, как далеко они смогут зайти.</p><button className="gold-button" onClick={()=>setShowIntro(false)}>Продолжить</button></div>}
      <p className="campaign-footnote">В кампании нет шаха и мата. Короля можно взять; сражение продолжается, пока на доске остаются пешки босса.</p>
    </Motion.div>
  );
}
