// Brand + UI icons. The invader grid is the RetroGamers logo read as pixels.
export const INVADER_ROWS = [
  "...X.....X...",
  "....X...X....",
  "..XXXXXXXXX..",
  ".XXXXXXXXXXX.",
  "XXX.XXXXX.XXX",
  "XXXXXXXXXXXXX",
  "XXXXXXXXXXXXX",
  "XX.XXXXXXX.XX",
  "XX.XX...XX.XX",
];

export function InvaderIcon({ className, title = "Retro Gamers" }: { className?: string; title?: string }) {
  const rects: React.ReactElement[] = [];
  INVADER_ROWS.forEach((row, j) =>
    [...row].forEach((c, i) => {
      if (c === "X") rects.push(<rect key={`${i}-${j}`} x={i} y={j} width={1.02} height={1.02} />);
    }),
  );
  return (
    <svg className={className} viewBox="0 0 13 9" fill="currentColor" role="img" aria-label={title} shapeRendering="crispEdges">
      {rects}
    </svg>
  );
}

// oval emblem in the header centre (same footprint as the reference 84x36 icon)
export function OvalEmblem({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 84 36" fill="none" aria-hidden="true">
      <ellipse cx="42" cy="18" rx="40.5" ry="16.5" stroke="currentColor" strokeWidth="3" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const y = 7 + i * 3.7;
        const dy = Math.abs(y - 18) / 16.5;
        const half = 36 * Math.sqrt(Math.max(0, 1 - dy * dy));
        return <line key={i} x1={42 - half} x2={42 + half} y1={y} y2={y} stroke="currentColor" strokeWidth="2.2" />;
      })}
    </svg>
  );
}

export function ArrowDown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <path d="M18 3v29M5 19l13 13 13-13" stroke="currentColor" strokeWidth="3.7" />
    </svg>
  );
}

export function ArrowUpRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M4 14L14 4M6 4h8v8" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function ArrowLeft({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <path d="M33 18H4M17 5L4 18l13 13" stroke="currentColor" strokeWidth="3.7" />
    </svg>
  );
}
