import { cn } from '@/shared/lib/cn';

export interface SkeletonProps {
  variant?: 'text' | 'card' | 'list';
  rows?: number;
  className?: string;
}

// Custom skeleton-shimmer keyframe (src/styles/index.css) replaces
// Tailwind's default animate-pulse — its 1 -> .5 opacity swing was too
// strong for the Obsidiana y Lima motion brief ("very subtle/barely
// perceptible"); the custom animation narrows that to 1 -> .82.
const pulse = 'animate-skeleton motion-reduce:animate-none bg-surface-2';

export function Skeleton({ variant = 'text', rows = 3, className }: SkeletonProps) {
  if (variant === 'text') {
    return <div className={cn(pulse, 'h-4 rounded-[var(--radius-sm)]', className)} />;
  }

  if (variant === 'card') {
    return (
      <div className={cn(pulse, 'rounded-[var(--radius-lg)] h-32', className)} />
    );
  }

  // list
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className={cn(pulse, 'size-11 rounded-full shrink-0')} />
          <div className="flex-1 flex flex-col gap-2">
            <div className={cn(pulse, 'h-4 w-2/3 rounded-[var(--radius-sm)]')} />
            <div className={cn(pulse, 'h-3 w-1/3 rounded-[var(--radius-sm)]')} />
          </div>
          <div className={cn(pulse, 'h-4 w-14 rounded-[var(--radius-sm)]')} />
        </div>
      ))}
    </div>
  );
}
