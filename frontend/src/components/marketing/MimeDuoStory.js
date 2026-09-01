import React, { useEffect, useLayoutEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

export const MIME_ACTS = [
  { id: 'search', title: "Who's nearby?", hint: 'Scrolling for a local pro' },
  { id: 'ping', title: 'Starts in 1 hour', hint: 'Reminder hits your phone' },
  { id: 'arrive', title: 'Knock knock', hint: 'The pro shows up' },
  { id: 'estimate', title: 'Sizing it up', hint: 'The quote, mimed' },
  { id: 'work', title: 'Elbow grease', hint: 'Job gets done' },
  { id: 'pay', title: 'The handover', hint: 'Invisible card' },
  { id: 'review', title: 'Bravo!', hint: 'Five silent stars' },
];

const ARRIVE_FRACTION = MIME_ACTS.findIndex((a) => a.id === 'arrive') / MIME_ACTS.length;

/** Hold act 1 until the user has scrolled this far into the zone (0–1). */
const STORY_LATE_START = 0.14;

export function useZoneScrollProgress(containerRef, stepCount, reduceMotionOverride) {
  const reduceMotionHook = useReducedMotion();
  const reduceMotion = reduceMotionOverride ?? reduceMotionHook;

  const [progress, setProgress] = useState(reduceMotion ? 1 : 0);
  const [activeIndex, setActiveIndex] = useState(reduceMotion ? stepCount - 1 : 0);

  useLayoutEffect(() => {
    const el = containerRef?.current;
    if (!el) return undefined;

    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (reduceMotion) {
          setProgress(1);
          setActiveIndex(stepCount - 1);
          return;
        }

        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        const h = el.offsetHeight || rect.height || 1;
        const span = Math.max(1, h - vh * 0.45);
        const raw = Math.min(1, Math.max(0, (vh * 0.44 - rect.top) / span));
        const p =
          raw <= STORY_LATE_START
            ? 0
            : Math.min(1, (raw - STORY_LATE_START) / (1 - STORY_LATE_START));
        setProgress(p);

        const idx = Math.min(stepCount - 1, Math.max(0, Math.floor(p * stepCount)));
        setActiveIndex((prev) => (prev === idx ? prev : idx));
      });
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [containerRef, reduceMotion, stepCount]);

  return { progress, activeIndex };
}

/** Loose clock so the mimes keep performing even when the page is still. */
function useMimeClock(active) {
  const [time, setTime] = useState(0);

  useEffect(() => {
    if (!active) return undefined;

    let raf = 0;
    let last = 0;
    const start = performance.now();
    const loop = (now) => {
      if (now - last > 55) {
        last = now;
        setTime((now - start) / 1000);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return time;
}

const DEG = Math.PI / 180;
const clamp01 = (n) => Math.min(1, Math.max(0, n));
const lerp = (a, b, t) => a + (b - a) * t;

/** Two-segment limb: angles in degrees, 90 points straight down. */
function limb(ox, oy, upper, lower, l1, l2) {
  const jx = ox + Math.cos(upper * DEG) * l1;
  const jy = oy + Math.sin(upper * DEG) * l1;
  const hx = jx + Math.cos(lower * DEG) * l2;
  const hy = jy + Math.sin(lower * DEG) * l2;
  return `M${ox} ${oy} L${jx.toFixed(1)} ${jy.toFixed(1)} L${hx.toFixed(1)} ${hy.toFixed(1)}`;
}

const SHOULDER_Y = -52;
const HIP_Y = -26;

function Mime({ x, y, facing = 1, color, pose }) {
  const { arms, legs, lean = 0, bob = 0, headTilt = 0 } = pose;

  return (
    <g transform={`translate(${x.toFixed(1)} ${(y + bob).toFixed(1)}) scale(${facing} 1)`}>
      <ellipse cx="0" cy="1" rx="11" ry="2.6" fill={color} opacity="0.13" />
      <g transform={`rotate(${lean.toFixed(1)} 0 0)`}>
        <path
          d={limb(0, HIP_Y, legs.l[0], legs.l[1], 13, 13)}
          fill="none"
          stroke={color}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={limb(0, HIP_Y, legs.r[0], legs.r[1], 13, 13)}
          fill="none"
          stroke={color}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <line x1="0" y1={SHOULDER_Y} x2="0" y2={HIP_Y} stroke={color} strokeWidth="2.8" strokeLinecap="round" />
        {[-47, -41, -35].map((stripeY) => (
          <line
            key={stripeY}
            x1="-4.5"
            y1={stripeY}
            x2="4.5"
            y2={stripeY}
            stroke={color}
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.55"
          />
        ))}

        <path
          d={limb(0, SHOULDER_Y, arms.l[0], arms.l[1], 12, 12)}
          fill="none"
          stroke={color}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={limb(0, SHOULDER_Y, arms.r[0], arms.r[1], 12, 12)}
          fill="none"
          stroke={color}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <g transform={`rotate(${headTilt.toFixed(1)} 0 ${SHOULDER_Y})`}>
          <circle cx="0" cy="-61" r="7.6" fill="#ffffff" stroke={color} strokeWidth="2.2" />
          <circle cx="2.6" cy="-62.5" r="1.1" fill={color} />
          <circle cx="-2.4" cy="-62.5" r="1.1" fill={color} />
          <path d="M-2.6 -58.4 Q0 -56.4 2.8 -58.6" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M-8.4 -66.4 Q0 -74.6 8.4 -66.4 Z" fill={color} opacity="0.9" />
          <circle cx="0" cy="-75" r="1.5" fill={color} />
        </g>
      </g>
    </g>
  );
}

function walkCycle(phase) {
  const swing = Math.sin(phase) * 26;
  return {
    legs: { l: [90 + swing, 90 + swing * 0.45], r: [90 - swing, 90 - swing * 0.45] },
    arms: { l: [95 - swing * 0.7, 92 - swing * 0.5], r: [85 + swing * 0.7, 88 + swing * 0.5] },
    bob: Math.abs(Math.cos(phase)) * -1.4,
  };
}

const IDLE_LEGS = { l: [96, 92], r: [84, 88] };

function customerPose(act, t, entering, phase) {
  if (entering) return { ...walkCycle(phase), lean: 2 };

  const breathe = Math.sin(t * 1.6) * 1.2;

  switch (act) {
    case 'search': {
      const swipe = Math.sin(t * 3);
      return {
        arms: { l: [2, 18], r: [-10, 44 + swipe * 34] },
        legs: IDLE_LEGS,
        headTilt: 11 + swipe * 1.5,
        bob: breathe * 0.3,
      };
    }
    case 'ping': {
      const peek = Math.sin(t * 2.6);
      return {
        arms: { l: [108, 112], r: [-24 + peek * 3, -56 + peek * 5] },
        legs: IDLE_LEGS,
        headTilt: 8 + peek * 1.5,
        bob: breathe * 0.3,
      };
    }
    case 'arrive':
      return {
        arms: { l: [104, 100], r: [78 + breathe, 70 + breathe] },
        legs: IDLE_LEGS,
        headTilt: -4 + breathe * 0.6,
        bob: breathe * 0.4,
      };
    case 'estimate':
      return {
        arms: { l: [104, 98], r: [-20, -150 + Math.sin(t * 3) * 9] },
        legs: IDLE_LEGS,
        headTilt: 6,
        bob: breathe * 0.3,
      };
    case 'work':
      return {
        arms: { l: [110, 128], r: [70, 46 + Math.sin(t * 2.2) * 8] },
        legs: IDLE_LEGS,
        headTilt: -6,
        bob: breathe * 0.3,
      };
    case 'pay': {
      const reach = Math.sin(t * 3) * 6;
      return {
        arms: { l: [102, 96], r: [4 + reach, -2 + reach] },
        legs: IDLE_LEGS,
        headTilt: 3,
        bob: breathe * 0.3,
      };
    }
    default: {
      const clap = Math.abs(Math.sin(t * 6));
      return {
        arms: { l: [36 - clap * 14, 20 - clap * 22], r: [-4 + clap * 12, 14 + clap * 16] },
        legs: IDLE_LEGS,
        headTilt: -3,
        bob: -clap * 2.2,
      };
    }
  }
}

function providerPose(act, t, entering, phase) {
  if (entering) return { ...walkCycle(phase + 1.4), lean: -2 };

  const breathe = Math.sin(t * 1.7 + 1) * 1.2;

  switch (act) {
    case 'arrive': {
      const knock = Math.abs(Math.sin(t * 6));
      return {
        arms: { l: [100, 96], r: [-30, -26 + knock * 34] },
        legs: IDLE_LEGS,
        headTilt: 4,
        bob: -knock * 0.8,
      };
    }
    case 'estimate': {
      const stretch = Math.sin(t * 2.4) * 9;
      return {
        arms: { l: [12 + stretch, 2 + stretch], r: [-6 - stretch, 6 - stretch] },
        legs: IDLE_LEGS,
        headTilt: -3,
        bob: breathe * 0.3,
      };
    }
    case 'work': {
      const scrub = Math.sin(t * 7);
      return {
        arms: { l: [30 + scrub * 22, 52 + scrub * 26], r: [16 + scrub * 20, 44 + scrub * 24] },
        legs: { l: [100, 96], r: [72, 84] },
        lean: 8 + scrub * 2,
        headTilt: 5,
        bob: -Math.abs(scrub) * 1.6,
      };
    }
    case 'pay': {
      const take = Math.sin(t * 3 + 1) * 5;
      return {
        arms: { l: [100, 94], r: [8 + take, 0 + take] },
        legs: IDLE_LEGS,
        headTilt: -4,
        bob: breathe * 0.3,
      };
    }
    default: {
      const bow = (Math.sin(t * 2) + 1) / 2;
      return {
        arms: { l: [70 + bow * 20, 46 + bow * 30], r: [104, 120] },
        legs: IDLE_LEGS,
        lean: 6 + bow * 20,
        headTilt: 10,
        bob: 0,
      };
    }
  }
}

const DASH = { fill: 'none', stroke: '#0d9488', strokeWidth: 1.6, strokeDasharray: '4 4', strokeLinecap: 'round' };

function ActProps({ act, t }) {
  switch (act) {
    case 'search': {
      const swipe = Math.sin(t * 3);
      return (
        <g>
          <rect x="94" y="186" width="16" height="26" rx="3" {...DASH} />
          <line x1="97" y1={205 + swipe * 2} x2="107" y2={205 + swipe * 2} stroke="#0d9488" strokeWidth="1.2" opacity="0.5" />
          {[0, 1, 2].map((i) => {
            const u = (t * 0.32 + i / 3) % 1;
            const cardY = 208 - u * 44;
            return (
              <g key={i} opacity={Math.sin(Math.PI * u) * 0.85}>
                <rect x="116" y={cardY} width="24" height="11" rx="2.5" {...DASH} strokeDasharray="3 3" />
                <circle cx="122" cy={cardY + 5.5} r="2.6" fill="#0d9488" opacity="0.55" />
                <line x1="127" y1={cardY + 4} x2="136" y2={cardY + 4} stroke="#0d9488" strokeWidth="1.1" opacity="0.5" />
                <line x1="127" y1={cardY + 7.5} x2="133" y2={cardY + 7.5} stroke="#0d9488" strokeWidth="1.1" opacity="0.35" />
              </g>
            );
          })}
        </g>
      );
    }
    case 'ping': {
      const buzz = Math.sin(t * 14) * 0.8;
      const pulse = (Math.sin(t * 3) + 1) / 2;
      return (
        <g transform={`translate(${buzz.toFixed(2)} 0)`}>
          <rect x="86" y="176" width="14" height="22" rx="3" {...DASH} />
          <line x1="89" y1="181" x2="97" y2="181" stroke="#0d9488" strokeWidth="1.2" opacity="0.6" />
          <line x1="89" y1="185" x2="95" y2="185" stroke="#0d9488" strokeWidth="1.2" opacity="0.45" />
          <circle cx="100" cy="176" r="3.2" fill="#f59e0b" opacity={0.55 + pulse * 0.45} />
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={`M${102 + i * 5} ${180 - i * 3} q4 -5 0 -11`}
              {...DASH}
              strokeDasharray="3 3"
              opacity={clamp01(pulse * 1.4 - i * 0.3) * 0.7}
            />
          ))}
          <text x="93" y="168" textAnchor="middle" fill="#0f766e" style={{ fontSize: 9, fontWeight: 800 }}>
            1h
          </text>
        </g>
      );
    }
    case 'arrive':
      return (
        <g>
          <rect x="94" y="170" width="28" height="80" rx="3" {...DASH} />
          <circle cx="117" cy="210" r="2" fill="#0d9488" opacity="0.7" />
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={`M${124 + i * 6} ${192 - i * 4} q4 -4 0 -9`}
              {...DASH}
              strokeDasharray="3 3"
              opacity={0.55 - i * 0.15}
            />
          ))}
        </g>
      );
    case 'estimate': {
      const w = 10 + Math.sin(t * 2.4) * 6;
      return (
        <g>
          <line x1={120 - w} y1="196" x2={120 + w} y2="196" {...DASH} />
          <line x1={120 - w} y1="191" x2={120 - w} y2="201" {...DASH} strokeDasharray="0" />
          <line x1={120 + w} y1="191" x2={120 + w} y2="201" {...DASH} strokeDasharray="0" />
          <text x="120" y="184" textAnchor="middle" fill="#0f766e" style={{ fontSize: 9, fontWeight: 700 }}>
            $?
          </text>
        </g>
      );
    }
    case 'work': {
      const sweep = Math.sin(t * 7) * 8;
      return (
        <g>
          <path d={`M${128 + sweep} 206 L${112 + sweep * 1.6} 248`} {...DASH} strokeDasharray="0" opacity="0.5" />
          <path d={`M${106 + sweep * 1.6} 248 h14`} {...DASH} strokeWidth="4" strokeDasharray="0" opacity="0.35" />
          {[0, 1, 2].map((i) => {
            const twinkle = (Math.sin(t * 4 + i * 1.7) + 1) / 2;
            return (
              <path
                key={i}
                d={`M${92 + i * 12} ${226 - i * 9} l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2 z`}
                fill="#14b8a6"
                opacity={0.25 + twinkle * 0.6}
              />
            );
          })}
        </g>
      );
    }
    case 'pay': {
      const slide = (Math.sin(t * 3) + 1) / 2;
      const cardX = lerp(94, 112, slide);
      const cardCx = cardX + 9;
      const cardCy = 196;
      return (
        <g>
          <rect x={cardX} y="190" width="18" height="12" rx="2" {...DASH} />
          <text
            x={cardCx}
            y={cardCy}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#0f766e"
            style={{ fontSize: 8, fontWeight: 800 }}
          >
            $
          </text>
          <path d="M92 210 q16 8 34 0" {...DASH} strokeDasharray="3 4" opacity="0.5" />
        </g>
      );
    }
    default:
      return (
        <g>
          {[0, 1, 2, 3, 4].map((i) => {
            const pop = clamp01(Math.sin(t * 2.4 - i * 0.4));
            return (
              <path
                key={i}
                d={`M${78 + i * 13} ${152 - pop * 8} l2.6 5.4 5.8 0.8 -4.2 4 1 5.8 -5.2 -2.8 -5.2 2.8 1 -5.8 -4.2 -4 5.8 -0.8 z`}
                fill="#f59e0b"
                opacity={0.25 + pop * 0.75}
              />
            );
          })}
          <path d="M80 200 q28 -14 56 0" {...DASH} strokeDasharray="3 5" opacity="0.45" />
        </g>
      );
  }
}

export default function MimeDuoStory({ progress = 0, activeIndex = 0, compact = false }) {
  const reduceMotion = useReducedMotion();
  const t = useMimeClock(!reduceMotion);
  const index = Math.min(activeIndex, MIME_ACTS.length - 1);
  const current = MIME_ACTS[index];

  const customerEntry = reduceMotion ? 1 : clamp01(progress / 0.05);
  const providerEntry = reduceMotion ? 1 : clamp01((progress - (ARRIVE_FRACTION - 0.02)) / 0.05);
  const phase = t * 7;

  const customerX = lerp(28, 74, customerEntry);
  const providerX = lerp(215, 142, providerEntry);
  const groundY = 250;

  return (
    <figure className="m-0" aria-label={`Mime act: ${current.title}`}>
      <figcaption className={compact ? 'text-center' : ''}>
        <p className="text-lg font-extrabold tracking-tight text-slate-900">{current.title}</p>
        <p className="text-xs text-slate-500">{current.hint}</p>
        <div className={`mt-2 flex gap-1.5 ${compact ? 'justify-center' : ''}`}>
          {MIME_ACTS.map((stage, i) => (
            <span
              key={stage.id}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === index ? 'w-6 bg-teal-600' : i < index ? 'w-3 bg-teal-300' : 'w-3 bg-slate-200'
              }`}
            />
          ))}
        </div>
      </figcaption>

      <svg
        viewBox={compact ? '14 140 200 126' : '44 140 148 126'}
        className={compact ? 'mx-auto mt-2 w-full max-w-[300px]' : 'mt-3 w-full'}
        role="img"
        aria-label="Two stick-figure mimes act out a booking: search, reminder, knock, quote, work, pay, applause"
      >
        <line
          x1="0"
          y1={groundY}
          x2="240"
          y2={groundY}
          stroke="#5eead4"
          strokeWidth="2"
          strokeDasharray="6 7"
          strokeLinecap="round"
          opacity="0.85"
        />
        {customerEntry === 1 && <ActProps act={current.id} t={t} />}
        <Mime
          x={customerX}
          y={groundY}
          facing={1}
          color="#334155"
          pose={customerPose(current.id, t, customerEntry < 1, phase)}
        />
        <Mime
          x={providerX}
          y={groundY}
          facing={-1}
          color="#0f766e"
          pose={providerPose(current.id, t, providerEntry < 1, phase)}
        />
      </svg>
    </figure>
  );
}
