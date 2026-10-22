import { useEffect, useState } from 'react';

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Animates a number from 0 to `target` over `durationMs` using
 * requestAnimationFrame + an ease-out curve. Used for the BalanceCard
 * count-up on HomePage mount.
 *
 * CSS's prefers-reduced-motion rule (src/styles/index.css) cannot neutralize
 * a JS-driven rAF loop, so this hook checks
 * window.matchMedia('(prefers-reduced-motion: reduce)') itself and, when
 * set, skips straight to the end value with no animation frames at all.
 */
export function useCountUp(target: number, durationMs = 600): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }

    let rafId: number;
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / durationMs, 1);
      setValue(target * easeOutCubic(progress));
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return value;
}
