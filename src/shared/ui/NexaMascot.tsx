import { useEffect, useRef, useState } from 'react';
import { cn } from '@/shared/lib/cn';

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export type NexaState = 'idle' | 'wave' | 'excited' | 'ready';

export type NexaLookAt = 'left' | 'right' | 'up' | 'neutral';

export interface NexaMascotProps {
  state?: NexaState;
  /** Shrinks Nexa into the small corner-badge pose used on the form step. */
  compact?: boolean;
  /**
   * Hero-sized pose for the register form's bottom-half composition. The
   * outer wrapper spans the FULL WIDTH of its row (`size-hero`, acting as a
   * "stage" so a button can be centered/overlapped on top of Nexa without
   * looking off-axis), while the character mark itself (`size-hero-mark`)
   * stays square and centered within that stage so the rounded-square head
   * never stretches. Mutually exclusive with `compact`.
   */
  hero?: boolean;
  /**
   * Directional gaze for the eyes' pupils. Both fields that can hold focus
   * on the register form sit above Nexa, so 'left'/'right' both shift the
   * pupils upward and differ only in horizontal lean (toward whichever
   * field is focused). 'neutral' (default) is a relaxed forward gaze, not
   * locked to either side.
   */
  lookAt?: NexaLookAt;
  className?: string;
}

/**
 * "Nexa" — NexaBank's mascot. A rounded-square head evolved from the same
 * brand mark used in PhonePage.tsx (lime rounded-square badge, bold "N"
 * monogram): here the badge grows a face instead of a letter, keeping the
 * same geometric/sober "Obsidiana y Lima" language rather than a clashing
 * cutesy illustration style.
 *
 * Built as inline SVG + a plain positioned "arm" div so individual parts
 * (eyes, mouth, arm) can be animated independently with CSS classes/keyframes
 * defined in src/styles/index.css (nexa-float/nexa-blink/nexa-wave/
 * nexa-entrance/nexa-shrink/nexa-present/nexa-float-energetic).
 *
 * Reduced motion: the idle float loop and the wave animation are NOT
 * rendered at all (the CSS classes are simply omitted) rather than relying
 * only on the global prefers-reduced-motion rule. That global rule still
 * covers them (infinite animations collapse to their end pose almost
 * instantly), but omitting the class outright avoids a one-frame flash of
 * the loop's mid-cycle offset and is clearer than depending on the global
 * rule for a loop with a non-trivial mid-state (float at -6px, blink
 * squashed). The blink timer itself is also skipped entirely under reduced
 * motion (no interval is scheduled), not just class-gated. The same
 * approach is used for the 'ready' state's one-shot presenting gesture
 * below: under reduced motion the gesture class is omitted and Nexa renders
 * directly in its settled end-pose/expression instead of playing the swing.
 */
export function NexaMascot({ state = 'idle', compact = false, hero = false, lookAt = 'neutral', className }: NexaMascotProps) {
  const reduceMotion = prefersReducedMotion();
  const [entered, setEntered] = useState(reduceMotion);
  const [blinking, setBlinking] = useState(false);
  const blinkTimerRef = useRef<number | undefined>(undefined);

  // One-shot "presenting" gesture for the 'ready' state: plays once when
  // entering 'ready', then settles (gesture class removed) so the element
  // doesn't keep re-triggering the animation on every re-render while the
  // form stays valid. Skipped entirely under reduced motion — the arm
  // renders straight into its settled forward-down pose instead.
  const [presenting, setPresenting] = useState(state === 'ready' && !reduceMotion);
  const prevStateRef = useRef(state);
  useEffect(() => {
    if (state === 'ready' && prevStateRef.current !== 'ready' && !reduceMotion) {
      setPresenting(true);
      const timer = window.setTimeout(() => setPresenting(false), 560);
      prevStateRef.current = state;
      return () => window.clearTimeout(timer);
    }
    prevStateRef.current = state;
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Entrance: spring scale+translateY-in on first mount, instant in final
  // position under reduced motion (same pattern as StepSlide/ResultStep).
  useEffect(() => {
    if (reduceMotion) return;
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Occasional blink: a real blink is a rare, irregular event rather than a
  // steady loop, so it's driven by a randomized timer that toggles a
  // one-shot animation class instead of an infinite CSS keyframe. Skipped
  // entirely under reduced motion.
  useEffect(() => {
    if (reduceMotion) return;

    function scheduleBlink() {
      const delay = 2600 + Math.random() * 2400; // 2.6s-5s, feels organic
      blinkTimerRef.current = window.setTimeout(() => {
        setBlinking(true);
        window.setTimeout(() => setBlinking(false), 180);
        scheduleBlink();
      }, delay);
    }

    scheduleBlink();
    return () => window.clearTimeout(blinkTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 'excited' keeps its existing static wide-smile expression; 'ready' reuses
  // that same wide-smile mouth (per the brief: "switching Nexa's expression
  // to the existing excited mouth state") while being a distinct NexaState
  // so it can also drive the one-shot gesture + energetic idle below.
  const wideSmile = state === 'excited' || state === 'ready';
  const energeticIdle = state === 'ready' && !presenting;

  // Pupil offsets: both 'left' and 'right' shift upward (both fields sit
  // above Nexa), differing only in horizontal lean. 'up' is kept as a
  // straight-up option and 'neutral' is a relaxed forward gaze (no offset).
  const pupilOffset: Record<NexaLookAt, { x: number; y: number }> = {
    neutral: { x: 0, y: 0 },
    up: { x: 0, y: -2.5 },
    left: { x: -2, y: -2.5 },
    right: { x: 2, y: -2.5 },
  };
  const offset = pupilOffset[lookAt];

  const sizePx = compact ? 44 : hero ? undefined : 112;

  // Hero needs two nested boxes: an outer full-width "stage" (so a caller
  // can center/overlap other elements like a button against Nexa's row)
  // and an inner square "mark" box that the character itself + its
  // entrance/float/arm animations actually live in — keeping the rounded-
  // square head's proportions intact regardless of the stage's width.
  const markClassName = cn(
    'relative inline-flex items-center justify-center',
    !reduceMotion && 'animate-nexa-entrance',
    !reduceMotion && !compact && !energeticIdle && 'animate-nexa-float',
    !reduceMotion && energeticIdle && 'animate-nexa-float-energetic',
    compact && 'animate-nexa-shrink',
    hero && 'size-hero-mark',
    !hero && className,
  );
  const markStyle = entered || reduceMotion ? undefined : { opacity: 0, transform: 'scale(0.6) translateY(16px)' };

  const mark = (
    <div className={markClassName} style={markStyle} aria-hidden="true">
      {/* Arm: a rounded "hand" that rotates in from the shoulder for the wave
          state, or swings forward-and-down for the 'ready' presenting
          gesture. Positioned absolutely over the head's right side. */}
      {state === 'wave' && !compact && (
        <div
          className={cn(
            'absolute -right-2 top-[38%] size-5 rounded-full bg-primary origin-bottom-left',
            !reduceMotion && 'animate-nexa-wave',
          )}
          style={{ transform: reduceMotion ? 'rotate(-20deg)' : undefined }}
        />
      )}
      {state === 'ready' && !compact && (
        <div
          className={cn(
            'absolute -right-2 top-[38%] size-5 rounded-full bg-primary origin-top-left',
            presenting && 'animate-nexa-present',
          )}
          style={{ transform: !presenting ? 'rotate(32deg) translateY(4px)' : undefined }}
        />
      )}

      <svg
        width={sizePx}
        height={sizePx}
        viewBox="0 0 112 112"
        className={hero ? 'size-full' : undefined}
        fill="none"
      >
        {/* Head: rounded-square, lime fill — the evolution of the existing
            brand-mark badge (dark "N" on lime in PhonePage.tsx). A lime fill
            reads more "character-like" at a glance than a dark surface with
            a lime outline would at small/compact sizes, so fill won out. */}
        <rect x="4" y="4" width="104" height="104" rx="28" fill="var(--color-primary)" />

        {/* Eyes: circles with an inner pupil, squashed together on blink.
            transform-origin is the center of each eye so the squash reads
            as a blink, not a slide. The pupil shifts per `lookAt`, with a
            smooth transition that is disabled (instant) under reduced
            motion — same gating pattern as the blink squash transition. */}
        <g
          style={{
            transformOrigin: '38px 52px',
            transform: blinking ? 'scaleY(0.1)' : 'scaleY(1)',
            transition: reduceMotion ? 'none' : 'transform 90ms ease-in-out',
          }}
        >
          <circle cx="38" cy="52" r="7" fill="var(--color-on-primary)" />
          <circle
            cx={38 + offset.x}
            cy={52 + offset.y}
            r="2.6"
            fill="var(--color-primary)"
            style={{ transition: reduceMotion ? 'none' : 'cx 180ms ease-out, cy 180ms ease-out' }}
          />
        </g>
        <g
          style={{
            transformOrigin: '74px 52px',
            transform: blinking ? 'scaleY(0.1)' : 'scaleY(1)',
            transition: reduceMotion ? 'none' : 'transform 90ms ease-in-out',
          }}
        >
          <circle cx="74" cy="52" r="7" fill="var(--color-on-primary)" />
          <circle
            cx={74 + offset.x}
            cy={52 + offset.y}
            r="2.6"
            fill="var(--color-primary)"
            style={{ transition: reduceMotion ? 'none' : 'cx 180ms ease-out, cy 180ms ease-out' }}
          />
        </g>

        {/* Mouth: a simple rounded arc. Slightly wider/more curved for the
            "excited"/"ready" states (standout benefit step + validity-ready
            form), flatter smile otherwise — the only per-step expression
            variant, kept cheap and restrained per the brand's sober tone. */}
        {wideSmile ? (
          <path
            d="M34 70 Q56 90 78 70"
            stroke="var(--color-on-primary)"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          <path
            d="M38 72 Q56 84 74 72"
            stroke="var(--color-on-primary)"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
        )}
      </svg>
    </div>
  );

  if (!hero) return mark;

  // Hero stage: full-width row the character mark centers in. `className`
  // (e.g. layout/overlap utilities from the call site) applies here, to the
  // stage, not to the inner mark — so callers positioning Nexa against a
  // button don't fight the mark's own fixed square sizing.
  return (
    <div className={cn('relative flex items-center justify-center', 'size-hero', className)}>
      {mark}
    </div>
  );
}
