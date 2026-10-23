import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export interface StepSlideProps {
  children: ReactNode;
  /** 1 = advancing forward (slide in from the right), -1 = going back (slide in from the left). */
  direction: 1 | -1;
  className?: string;
}

/**
 * Animated step-transition primitive: a 200ms horizontal slide + fade keyed
 * by the caller's `key` prop (so remounting on step change re-triggers the
 * entrance). Originally built inline in TransferPage.tsx, extracted here so
 * other multi-step flows (e.g. the RegisterPage onboarding tour) can reuse
 * the exact same choreography.
 *
 * CSS transition-duration is neutralized globally under
 * prefers-reduced-motion (src/styles/index.css), so no separate JS branch is
 * required here beyond what that rule covers — entered still starts true
 * when reduced motion is on, skipping the slide-in offset entirely.
 */
export function StepSlide({ children, direction, className }: StepSlideProps) {
  const [entered, setEntered] = useState(prefersReducedMotion());

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className={
        className ??
        'flex-1 flex flex-col transition-[transform,opacity] duration-200 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none'
      }
      style={{
        transform: entered ? 'translateX(0)' : `translateX(${direction * 16}px)`,
        opacity: entered ? 1 : 0,
      }}
    >
      {children}
    </div>
  );
}
