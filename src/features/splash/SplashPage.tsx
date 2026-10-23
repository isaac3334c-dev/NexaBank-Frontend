import { useEffect, useId, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';

type Phase = 'assemble' | 'resolve' | 'exit';

// Durations must match the animate-* keyframe durations in src/styles/
// index.css — kept as plain constants (not read from CSS) since there's no
// shared source of truth for keyframe timing in this codebase. Total launch
// sequence: 2.5s (1300 + 700 + 500).
const PHASE_DURATIONS: Record<Phase, number> = {
  assemble: 1300,
  resolve: 700,
  exit: 500,
};

// "N" mark centerline: left vertical, diagonal, right vertical. Also used,
// stroked, to draw the final mark — see the two-pass stroke technique below.
const N_PATH = 'M10,90 L10,10 L70,90 L70,10';
const N_PATH_SEGMENTS: Array<[number, number, number, number, number]> = [
  [10, 90, 10, 10, 7], // left vertical stroke
  [10, 10, 70, 90, 9], // diagonal stroke
  [70, 90, 70, 10, 7], // right vertical stroke
];
// Scales the 0-80 x / 0-100 y path space to on-screen pixels.
const SCALE = 1.7;
// Outer "tube" width and the background-colored width punched on top of it
// — see the comment on the <svg> below for why this is two strokes, not one.
const N_OUTER_WIDTH = 22;
const N_INNER_WIDTH = 13;

interface Particle {
  ex: number;
  ey: number;
  sx: number;
  sy: number;
  delay: number;
}

// Deterministic pseudo-random (not Math.random) so the scatter layout is
// identical on every load instead of reshuffling per render/session.
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function buildParticles(): Particle[] {
  const particles: Particle[] = [];
  let seed = 1;
  for (const [x1, y1, x2, y2, count] of N_PATH_SEGMENTS) {
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const ex = (x1 + (x2 - x1) * t - 40) * SCALE;
      const ey = (y1 + (y2 - y1) * t - 50) * SCALE;
      const angle = pseudoRandom(seed++) * Math.PI * 2;
      const radius = 90 + pseudoRandom(seed++) * 90;
      const sx = Math.cos(angle) * radius;
      const sy = Math.sin(angle) * radius;
      const delay = 80 + pseudoRandom(seed++) * 480;
      particles.push({ ex, ey, sx, sy, delay });
    }
  }
  return particles;
}

const PARTICLES = buildParticles();

export interface SplashPageProps {
  /**
   * Where the sequence lands once the exit phase finishes. Defaults to the
   * original boot-splash destination ('/auth/phone') so the '/' route's
   * behavior is unchanged. Also reused as a post-registration loading step
   * (redirectTo="/app/home") via the '/auth/loading' route — same visual
   * sequence, different landing route, nothing else about the animation
   * changes.
   */
  redirectTo?: string;
}

export function SplashPage({ redirectTo = '/auth/phone' }: SplashPageProps) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('assemble');
  // SVG mask ids referenced via url(#...) — strip useId()'s colons, which
  // some SVG id resolution paths handle inconsistently.
  const maskId = `splash-n-mask-${useId().replace(/:/g, '')}`;

  useEffect(() => {
    const order: Phase[] = ['assemble', 'resolve', 'exit'];
    const index = order.indexOf(phase);
    const timer = window.setTimeout(() => {
      if (index + 1 < order.length) {
        setPhase(order[index + 1]);
      } else {
        navigate(redirectTo, { replace: true });
      }
    }, PHASE_DURATIONS[phase]);
    return () => window.clearTimeout(timer);
  }, [phase, navigate, redirectTo]);

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-bg">
      {/* Subtle fixed glow behind the phone silhouette — flat obsidian
          background otherwise, no color pulsing this time. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--color-primary) 14%, transparent), transparent 60%)',
        }}
        aria-hidden="true"
      />

      {/* Centered mark — the phone-outline chrome from the previous version
          is gone; the exit here is a forward zoom (scale toward the viewer)
          instead of a plain fade. */}
      <div className={`flex flex-col items-center gap-3 ${phase === 'exit' ? 'animate-splash-zoom-exit' : ''}`}>
        <div className="relative" style={{ width: 80 * SCALE, height: 100 * SCALE }}>
          {/* Particle cloud: scatters, then converges onto the "N" mark's
              points. Dissolves away once the solid stroke has drawn itself
              in the resolve phase. */}
          <div className={`absolute inset-0 ${phase !== 'assemble' ? 'animate-particle-dissolve' : ''}`}>
            {PARTICLES.map((p, i) => (
              <span
                key={i}
                className="absolute left-1/2 top-1/2 size-[5px] rounded-full bg-primary animate-particle-converge"
                style={
                  {
                    '--sx': `${p.sx}px`,
                    '--sy': `${p.sy}px`,
                    '--ex': `${p.ex}px`,
                    '--ey': `${p.ey}px`,
                    '--particle-delay': `${p.delay}ms`,
                  } as CSSProperties
                }
              />
            ))}
          </div>

          {/* Resolves the particle cloud into the final mark. Earlier
              attempts: (1) CSS -webkit-text-stroke on a bold glyph strokes
              each of the glyph's sub-contours independently, showing up as
              overlapping, badly-cut rectangles at sharp corners; (2)
              layering the same glyph twice (full size + scaled down)
              doesn't offset a diagonal stroke's edges evenly, so the ring
              came out uneven. SVG's own path-stroke renderer offsets every
              segment correctly regardless of angle, so: stroke the
              three-segment centerline at the full tube width, then use an
              <mask> built from that same stroke at a narrower width to cut
              a true transparent hole out of the middle — not a path
              painted in the page's background color, which would flatten
              whatever sits behind it (e.g. the glow above) instead of
              showing it through. Square caps + miter joins give the flat,
              cut corners. */}
          {(phase === 'resolve' || phase === 'exit') && (
            <svg
              viewBox="0 0 80 100"
              width={80 * SCALE}
              height={100 * SCALE}
              className="absolute inset-0 animate-splash-mark-in [filter:drop-shadow(0_0_7px_var(--color-primary))_drop-shadow(0_0_16px_var(--color-primary))]"
              aria-hidden="true"
            >
              <defs>
                <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={80} height={100}>
                  <path
                    d={N_PATH}
                    fill="none"
                    stroke="white"
                    strokeWidth={N_OUTER_WIDTH}
                    strokeLinecap="square"
                    strokeLinejoin="miter"
                  />
                  <path
                    d={N_PATH}
                    fill="none"
                    stroke="black"
                    strokeWidth={N_INNER_WIDTH}
                    strokeLinecap="square"
                    strokeLinejoin="miter"
                  />
                </mask>
              </defs>
              <path
                d={N_PATH}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth={N_OUTER_WIDTH}
                strokeLinecap="square"
                strokeLinejoin="miter"
                mask={`url(#${maskId})`}
              />
            </svg>
          )}
        </div>

        {(phase === 'resolve' || phase === 'exit') && (
          <h1 className="text-h2 text-primary animate-splash-wordmark-in">NexaBank</h1>
        )}
      </div>

      <span className="sr-only" role="status">
        Cargando NexaBank
      </span>
    </div>
  );
}
