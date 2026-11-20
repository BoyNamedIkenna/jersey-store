import { useId, type ReactNode } from "react";

export type Sport = "football" | "basketball" | "baseball";
export type Pattern = "solid" | "stripes" | "hoops" | "sash" | "halves";

export interface JerseyProps {
  sport: Sport;
  primary: string; // body
  secondary: string; // sleeves / trim, and the second colour for patterns
  accent: string; // collar (football) and number
  pattern?: Pattern;
  number?: string;
  className?: string;
  title?: string;
}

// Silhouettes, drawn in a 240 x 260 box.
const SHORT_SLEEVE =
  "M92 22 L40 48 L14 100 L50 116 L58 94 L58 236 L182 236 L182 94 L190 116 L226 100 L200 48 L148 22 Q120 46 92 22 Z";
const TANK =
  "M82 20 L100 20 Q104 62 120 62 Q136 62 140 20 L158 20 Q150 72 178 104 L184 240 L56 240 L62 104 Q90 72 82 20 Z";
const SLEEVE_LEFT = "M79 29 L40 48 L14 100 L50 116 L58 94 Z";
const SLEEVE_RIGHT = "M161 29 L200 48 L226 100 L190 116 L182 94 Z";

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

export function Jersey({
  sport,
  primary,
  secondary,
  accent,
  pattern = "solid",
  number = "10",
  className,
  title,
}: JerseyProps) {
  // useId returns values like ":r1:"; colons break url(#...) references in some browsers.
  const uid = useId().replace(/:/g, "");
  const clipId = `clip-${uid}`;
  const shadeId = `shade-${uid}`;

  const isTank = sport === "basketball";
  const isBaseball = sport === "baseball";
  const outline = isTank ? TANK : SHORT_SLEEVE;

  // Baseball uses thin pinstripes, everything else uses wide stripes.
  const stripeWidth = isBaseball ? 2.5 : 14;
  const stripeStep = isBaseball ? 14 : 28;

  let patternShapes: ReactNode = null;
  if (pattern === "stripes") {
    patternShapes = range(-9, 9).map((k) => (
      <rect key={k} x={120 - stripeWidth / 2 + k * stripeStep} y={0} width={stripeWidth} height={260} fill={secondary} />
    ));
  } else if (pattern === "hoops") {
    patternShapes = range(0, 6).map((k) => (
      <rect key={k} x={0} y={24 + k * 40} width={240} height={20} fill={secondary} />
    ));
  } else if (pattern === "sash") {
    patternShapes = (
      <rect x={-40} y={118} width={320} height={34} fill={secondary} transform="rotate(-35 120 135)" />
    );
  } else if (pattern === "halves") {
    patternShapes = <rect x={120} y={0} width={120} height={260} fill={secondary} />;
  }

  const seam = "rgba(0,0,0,0.2)";

  return (
    <svg
      viewBox="0 0 240 260"
      className={className}
      role="img"
      aria-label={title ?? `${sport} jersey`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={outline} />
        </clipPath>
        <linearGradient id={shadeId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.14" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.14" />
        </linearGradient>
      </defs>

      {/* Everything inside this group is clipped to the jersey silhouette */}
      <g clipPath={`url(#${clipId})`}>
        <rect width="240" height="260" fill={primary} />
        {patternShapes}

        {/* Football: solid kits get coloured sleeves, a collar and sleeve seams */}
        {sport === "football" && (
          <>
            {pattern === "solid" && (
              <>
                <path d={SLEEVE_LEFT} fill={secondary} />
                <path d={SLEEVE_RIGHT} fill={secondary} />
              </>
            )}
            <path d="M79 29 L58 94" stroke={seam} strokeWidth="1.5" fill="none" />
            <path d="M161 29 L182 94" stroke={seam} strokeWidth="1.5" fill="none" />
            <path d="M92 22 Q120 46 148 22" stroke={accent} strokeWidth="9" fill="none" />
          </>
        )}

        {/* Basketball: trim on the neck, armholes and hem */}
        {isTank && (
          <>
            <path d="M100 20 Q104 62 120 62 Q136 62 140 20" stroke={secondary} strokeWidth="9" fill="none" />
            <path d="M82 20 Q90 72 62 104" stroke={secondary} strokeWidth="9" fill="none" />
            <path d="M158 20 Q150 72 178 104" stroke={secondary} strokeWidth="9" fill="none" />
            <rect x={0} y={231} width={240} height={10} fill={secondary} />
          </>
        )}

        {/* Baseball: collar, cuffs, button placket */}
        {isBaseball && (
          <>
            <path d="M92 22 Q120 46 148 22" stroke={secondary} strokeWidth="9" fill="none" />
            <path d="M14 100 L50 116" stroke={secondary} strokeWidth="9" fill="none" />
            <path d="M226 100 L190 116" stroke={secondary} strokeWidth="9" fill="none" />
            <path d="M79 29 L58 94" stroke={seam} strokeWidth="1.5" fill="none" />
            <path d="M161 29 L182 94" stroke={seam} strokeWidth="1.5" fill="none" />
            <line x1="120" y1="36" x2="120" y2="236" stroke={secondary} strokeWidth="2" />
            {range(0, 5).map((k) => (
              <circle key={k} cx="120" cy={62 + k * 28} r="2.6" fill={secondary} />
            ))}
          </>
        )}

        {/* Soft top-to-bottom shading so flat colours read as fabric */}
        <rect width="240" height="260" fill={`url(#${shadeId})`} />
      </g>

      {/* Outline keeps white jerseys visible on white backgrounds */}
      <path d={outline} fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth="1.5" />

      {/* Front number (baseball jerseys show a button placket instead) */}
      {!isBaseball && (
        <text
          x="120"
          y={isTank ? 176 : 168}
          textAnchor="middle"
          fontSize={isTank ? 72 : 64}
          fontWeight={800}
          fontFamily="Impact, 'Arial Black', sans-serif"
          fill={accent}
        >
          {number}
        </text>
      )}
    </svg>
  );
}