const PIECE_SHAPES = {
  p: <><circle cx="50" cy="27" r="13"/><path d="M39 42 Q50 36 61 42 L65 61 Q69 69 77 74 L77 82 H23 V74 Q31 69 35 61Z"/></>,
  r: <><path d="M29 19 H39 V29 H45 V19 H55 V29 H61 V19 H71 V39 L65 47 V67 Q70 72 77 76 V83 H23 V76 Q30 72 35 67 V47 L29 39Z"/><path d="M35 47 H65" fill="none" stroke="currentColor" strokeWidth="3"/></>,
  n: <><path d="M26 75 Q28 62 37 54 Q29 44 34 32 Q40 18 59 16 Q57 26 68 32 Q78 39 72 51 L66 63 Q72 69 78 76 V83 H22Z"/><path d="M51 29 Q58 25 63 31 Q58 37 50 35Z" fill="#f5d58b" stroke="none"/><path d="M38 54 Q50 47 65 53" fill="none" stroke="currentColor" strokeWidth="3"/></>,
  b: <><path d="M50 13 C62 22 68 31 63 42 Q58 52 55 60 L65 70 Q70 73 77 77 V83 H23 V77 Q30 73 35 70 L45 60 Q42 52 37 42 C32 31 38 22 50 13Z"/><path d="M43 25 L57 41" fill="none" stroke="#f5d58b" strokeWidth="4" strokeLinecap="round"/><circle cx="50" cy="18" r="4" fill="#f5d58b" stroke="none"/></>,
  q: <><path d="M25 37 L35 48 L40 29 L50 44 L60 29 L65 48 L75 37 L69 66 Q69 71 77 76 V83 H23 V76 Q31 71 31 66Z"/><path d="M25 37 L20 24 M35 48 L35 19 M50 44 L50 14 M65 48 L65 19 M75 37 L80 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/><circle cx="20" cy="22" r="5"/><circle cx="35" cy="17" r="5"/><circle cx="50" cy="12" r="5"/><circle cx="65" cy="17" r="5"/><circle cx="80" cy="22" r="5"/></>,
  k: <><path d="M28 41 L36 48 L39 31 L50 44 L61 31 L64 48 L72 41 L68 66 Q68 72 77 76 V83 H23 V76 Q32 72 32 66Z"/><path d="M50 7 V29 M40 18 H60" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/><circle cx="50" cy="7" r="4"/></>,
};

function ChessPiece({ kind, side, svgStyle }) {
  const light = side === "w";
  const fill = light ? "#f2e6ca" : "#27313b";
  const edge = light ? "#8f6c3c" : "#d3a452";
  const highlight = light ? "#fff8e8" : "#65717d";
  const gradientId = "boss-" + side + "-" + kind;
  return (
    <svg viewBox="0 0 100 100" style={svgStyle} aria-hidden="true" focusable="false">
      <defs><linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={highlight}/><stop offset=".48" stopColor={fill}/>
        <stop offset="1" stopColor={light ? "#c6a875" : "#111820"}/>
      </linearGradient></defs>
      <ellipse cx="50" cy="88" rx="28" ry="5" fill="#05080d" opacity=".32"/>
      <g fill={"url(#" + gradientId + ")"} stroke={edge} strokeWidth="2.5" strokeLinejoin="round">
        <path d="M23 78 Q50 72 77 78 L80 86 Q50 94 20 86Z"/>
        <path d="M29 74 Q50 68 71 74 L75 80 Q50 86 25 80Z"/>
        {PIECE_SHAPES[kind]}
      </g>
      <path d="M31 76 Q50 72 69 76" fill="none" stroke={highlight} strokeWidth="2" opacity=".72" strokeLinecap="round"/>
      <path d="M36 59 Q50 63 64 59" fill="none" stroke={highlight} strokeWidth="1.8" opacity=".48" strokeLinecap="round"/>
      {kind !== "p" && <path d="M46 49 L50 54 L54 49" fill="none" stroke={edge} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>}
    </svg>
  );
}

export const BOSS_PIECES = Object.fromEntries(
  ["p", "r", "n", "b", "q", "k"].flatMap((kind) =>
    ["w", "b"].map((side) => [
      side + kind.toUpperCase(),
      ({ svgStyle }) => <ChessPiece kind={kind} side={side} svgStyle={svgStyle}/>,
    ]),
  ),
);
