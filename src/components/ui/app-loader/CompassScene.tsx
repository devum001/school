import { memo } from "react";
import { HINGE, INK_PATH, VIEW_BOX } from "./compass-geometry";

/*
 * The compass is authored once, in its nominal (un-foreshortened) pose:
 * the pencil leg hangs straight down from the hinge and its graphite point
 * sits exactly on the leg's nominal length. The baked keyframes map that
 * single pose onto every frame of the revolution, so the pencil can never
 * detach from the leg or leave the circle — the whole mechanism is one rigid
 * body described by one rotate() + scaleY().
 *
 * Depth: parts that orbit the pivot are rendered twice — once before the
 * compass core and once after — and the generated visibility keyframes pick
 * the correct copy. The swap happens at the far left / far right of the
 * ellipse, where nothing overlaps, so it is imperceptible.
 */

type StopProps = { o: number | string; c: string; a?: number | string };

const Stop = ({ o, c, a }: StopProps) => (
  <stop offset={o} style={{ stopColor: c, ...(a === undefined ? null : { stopOpacity: a }) }} />
);

/** The pencil leg: hinge arm, clamp, painted body, sharpened tip. */
function PencilLeg({ u, depth }: { u: string; depth: "near" | "far" }) {
  return (
    <g className={`sw-pencil sw-pencil--${depth}`}>
      {/* Hinge arm — the metal part of the leg the pencil clamps onto */}
      <path d="M47.9 17.4 H52.1 L51.78 31.6 H48.22 Z" fill={`url(#${u}-body)`} />
      <path className="sw-detail" d="M48.5 18.2 H49.35 L49.15 31.1 H48.42 Z" fill="#ffffff" opacity={0.12} />

      {/* Pencil barrel */}
      <path d="M47.85 32.4 H52.15 V57.6 H47.85 Z" fill={`url(#${u}-pencil)`} />
      <path className="sw-detail" d="M48.5 33.2 H49.2 V57.6 H48.5 Z" fill="#ffffff" opacity={0.26} />
      {/* Sharpened cone + graphite. The point is the leg's nominal tip. */}
      <path d="M47.85 57.6 H52.15 L50.82 66.5 H49.18 Z" fill={`url(#${u}-wood)`} />
      <path className="sw-detail" d="M48.45 57.6 H49.5 L49.5 66.1 H49.05 Z" fill={`var(--sw-wood-lit)`} opacity={0.75} />
      <path d="M49.18 66.5 H50.82 L50 71 Z" fill={`url(#${u}-graphite)`} />

      {/* Clamp that holds the pencil to the leg */}
      <rect className="sw-edge" x={46.75} y={29.2} width={6.5} height={7.4} rx={1.3} fill={`url(#${u}-steel)`} />
      <rect className="sw-detail" x={47.4} y={30.1} width={1} height={5.6} rx={0.5} fill="#ffffff" opacity={0.5} />
      <circle cx={53.1} cy={32.9} r={1.45} fill={`url(#${u}-steel-tight)`} />
      <circle className="sw-detail" cx={53.1} cy={32.9} r={0.55} fill="var(--sw-steel-4)" opacity={0.75} />
    </g>
  );
}

/** Small eraser: a 3/4 block with a soft top face and a tinted end. */
function Eraser({ u, depth }: { u: string; depth: "near" | "far" }) {
  return (
    <g className={`sw-eraser sw-eraser--${depth}`}>
      <g transform="scale(1.14)">
      {/* top face */}
      <path d="M-5.3 -1.95 L-3.75 -3.5 H5.75 L4.2 -1.95 Z" fill={`url(#${u}-eraser-top)`} />
      {/* long face */}
      <path d="M-5.3 -1.95 H4.2 V2.05 H-5.3 Z" fill={`url(#${u}-eraser-face)`} />
      {/* tinted end + its side */}
      <path d="M1.75 -1.95 H4.2 V2.05 H1.75 Z" fill="var(--sw-eraser-tip)" />
      <path d="M4.2 -1.95 L5.75 -3.5 V0.5 L4.2 2.05 Z" fill="var(--sw-eraser-tip-shade)" />
      <path d="M1.75 -1.95 L3.3 -3.5 H5.75 L4.2 -1.95 Z" fill="var(--sw-eraser-tip)" opacity={0.85} />
      {/* paper sleeve */}
      <path className="sw-detail" d="M1.05 -1.95 H1.75 V2.05 H1.05 Z" fill="var(--sw-accent)" opacity={0.85} />
      <path className="sw-detail" d="M-5.3 -1.95 H4.2 V-1.2 H-5.3 Z" fill="#ffffff" opacity={0.5} />
      </g>
    </g>
  );
}

function CompassSceneImpl({ u }: { u: string }) {
  return (
    <svg className="sw-loader__svg" viewBox={VIEW_BOX} aria-hidden="true" focusable="false">
      <defs>
        {/* Brushed steel: lit edge, body, shaded edge, bounce light */}
        <linearGradient id={`${u}-steel`} x1="0" y1="0" x2="1" y2="0">
          <Stop o={0} c="var(--sw-steel-lit)" />
          <Stop o={0.28} c="var(--sw-steel-1)" />
          <Stop o={0.68} c="var(--sw-steel-3)" />
          <Stop o={1} c="var(--sw-steel-2)" />
        </linearGradient>
        <linearGradient id={`${u}-steel-tight`} x1="0" y1="0" x2="1" y2="1">
          <Stop o={0} c="var(--sw-steel-1)" />
          <Stop o={1} c="var(--sw-steel-4)" />
        </linearGradient>
        {/* Deep cobalt body of the compass */}
        <linearGradient id={`${u}-body`} x1="0" y1="0" x2="1" y2="0">
          <Stop o={0} c="var(--sw-body-lit)" />
          <Stop o={0.45} c="var(--sw-body-mid)" />
          <Stop o={1} c="var(--sw-body-shade)" />
        </linearGradient>
        {/* Painted pencil barrel */}
        <linearGradient id={`${u}-pencil`} x1="0" y1="0" x2="1" y2="0">
          <Stop o={0} c="var(--sw-pencil-lit)" />
          <Stop o={0.34} c="var(--sw-pencil-mid)" />
          <Stop o={0.78} c="var(--sw-pencil-shade)" />
          <Stop o={1} c="var(--sw-pencil-mid)" />
        </linearGradient>
        <linearGradient id={`${u}-wood`} x1="0" y1="0" x2="1" y2="0">
          <Stop o={0} c="var(--sw-wood-lit)" />
          <Stop o={0.6} c="var(--sw-wood)" />
          <Stop o={1} c="var(--sw-wood)" />
        </linearGradient>
        <linearGradient id={`${u}-graphite`} x1="0" y1="0" x2="1" y2="0">
          <Stop o={0} c="var(--sw-graphite-lit)" />
          <Stop o={0.55} c="var(--sw-graphite)" />
          <Stop o={1} c="var(--sw-graphite)" />
        </linearGradient>
        <linearGradient id={`${u}-eraser-top`} x1="0" y1="0" x2="0.3" y2="1">
          <Stop o={0} c="var(--sw-eraser-lit)" />
          <Stop o={1} c="var(--sw-eraser)" />
        </linearGradient>
        <linearGradient id={`${u}-eraser-face`} x1="0" y1="0" x2="0" y2="1">
          <Stop o={0} c="var(--sw-eraser)" />
          <Stop o={1} c="var(--sw-eraser-shade)" />
        </linearGradient>

        {/*
         * The "paper". A single very soft pool of icy white that fades to
         * fully transparent well inside the box, so it blends into whatever
         * background sits behind it — no edge, ring, card or platform.
         */}
        <radialGradient id={`${u}-surface`} cx="0.5" cy="0.5" r="0.5">
          <Stop o={0} c="var(--sw-surface-tint)" a="var(--sw-surface-strength)" />
          <Stop o={0.55} c="var(--sw-surface-tint)" a="calc(var(--sw-surface-strength) * 0.55)" />
          <Stop o={1} c="var(--sw-surface-tint)" a={0} />
        </radialGradient>
        {/* Ambient occlusion where the instrument meets the paper */}
        <radialGradient id={`${u}-ambient`} cx="0.5" cy="0.5" r="0.5">
          <Stop o={0} c="rgb(var(--sw-shadow-rgb))" a={0.1} />
          <Stop o={0.6} c="rgb(var(--sw-shadow-rgb))" a={0.045} />
          <Stop o={1} c="rgb(var(--sw-shadow-rgb))" a={0} />
        </radialGradient>
        {/* Tight contact shadow directly beneath a touching point */}
        <radialGradient id={`${u}-contact`} cx="0.5" cy="0.5" r="0.5">
          <Stop o={0} c="rgb(var(--sw-shadow-rgb))" a={0.34} />
          <Stop o={0.5} c="rgb(var(--sw-shadow-rgb))" a={0.17} />
          <Stop o={1} c="rgb(var(--sw-shadow-rgb))" a={0} />
        </radialGradient>
      </defs>

      {/* ---- Surface + contact shadows (always lowest) ---- */}
      <ellipse cx={50} cy={56} rx={37} ry={22} fill={`url(#${u}-surface)`} />
      <ellipse cx={50} cy={65.6} rx={31} ry={9.6} fill={`url(#${u}-ambient)`} />
      <ellipse cx={50} cy={63.5} rx={4.6} ry={1.7} fill={`url(#${u}-contact)`} />
      <ellipse className="sw-tip-shadow" cx={0} cy={0} rx={3.4} ry={1.25} fill={`url(#${u}-contact)`} />
      <ellipse className="sw-eraser-shadow" cx={0} cy={0} rx={6.8} ry={2.4} fill={`url(#${u}-contact)`} />

      {/* ---- The drawn circle ---- */}
      <path className="sw-ink" d={INK_PATH} pathLength={100} />

      {/* ---- Far side of the pivot ---- */}
      <PencilLeg u={u} depth="far" />
      <Eraser u={u} depth="far" />

      {/* ---- Compass core: on the axis of rotation, so genuinely static ---- */}
      <g>
        {/* Handle */}
        <rect x={47.75} y={4.2} width={4.5} height={11.6} rx={2.25} fill={`url(#${u}-body)`} />
        <ellipse cx={50} cy={4.7} rx={2.25} ry={1.05} fill="var(--sw-body-lit)" />
        <rect className="sw-detail" x={48.35} y={5.6} width={0.9} height={8.4} rx={0.45} fill="#ffffff" opacity={0.2} />
        <g className="sw-detail" stroke="#ffffff" strokeOpacity={0.14} strokeWidth={0.4} strokeLinecap="round">
          <path d="M48.9 7.1 V12.4 M50.1 7.1 V12.4 M51.3 7.1 V12.4" />
        </g>
        <rect x={47.45} y={13.4} width={5.1} height={3.4} rx={1} fill={`url(#${u}-steel)`} />

        {/* Needle leg: vertical, because it is the axis the compass spins on */}
        <path d="M47.9 17.4 H52.1 L51.62 31 H48.38 Z" fill={`url(#${u}-body)`} />
        <path className="sw-edge" d="M48.42 30 H51.58 L51.12 51.6 H48.88 Z" fill={`url(#${u}-steel)`} />
        <rect className="sw-edge" x={48.05} y={50.8} width={3.9} height={4.8} rx={0.9} fill={`url(#${u}-steel)`} />
        <rect className="sw-detail" x={48.55} y={51.6} width={0.8} height={3.2} rx={0.4} fill="#ffffff" opacity={0.45} />
        {/* The needle itself — its point is the pivot and the circle's centre */}
        <path className="sw-edge" d="M49.42 55.2 H50.58 L50 63 Z" fill={`url(#${u}-steel-tight)`} />

        {/* Hinge head + pivot screw */}
        <path
          d="M50 12.6 C53.7 12.6 55.45 15.7 55.45 19.3 C55.45 23.1 53 25.9 50 25.9 C47 25.9 44.55 23.1 44.55 19.3 C44.55 15.7 46.3 12.6 50 12.6 Z"
          fill={`url(#${u}-body)`}
        />
        <path
          className="sw-detail"
          d="M50 13.4 C52.2 13.4 53.6 14.9 54.2 16.8 C53.2 15.2 51.7 14.3 50 14.3 C48.3 14.3 46.8 15.2 45.8 16.8 C46.4 14.9 47.8 13.4 50 13.4 Z"
          fill="#ffffff"
          opacity={0.22}
        />
      </g>

      {/* ---- Near side of the pivot ---- */}
      <PencilLeg u={u} depth="near" />
      <Eraser u={u} depth="near" />

      {/* Pivot screw caps the hinge, so it stays on top of whichever leg is
          in front — exactly how the real fastener sits on the assembly. */}
      <circle cx={HINGE.x} cy={HINGE.y + 0.4} r={2.4} fill={`url(#${u}-steel)`} />
      <circle className="sw-detail" cx={HINGE.x} cy={HINGE.y + 0.4} r={1.05} fill="var(--sw-steel-3)" />
      <circle className="sw-detail" cx={HINGE.x - 0.6} cy={HINGE.y - 0.3} r={0.5} fill="#ffffff" opacity={0.55} />
    </svg>
  );
}

/**
 * Pure, static markup. Memoised so a parent re-rendering (a changing progress
 * message, a parent list update) never touches the SVG or restarts the CSS
 * timeline. All motion lives in the stylesheet — React does no per-frame work.
 */
export const CompassScene = memo(CompassSceneImpl);
CompassScene.displayName = "CompassScene";
export default CompassScene;
