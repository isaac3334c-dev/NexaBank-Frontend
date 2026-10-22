import { cloneElement, isValidElement } from 'react';
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

export interface QuickActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
}

export function QuickAction({ icon, label, className, ...props }: QuickActionProps) {
  const iconWithStroke = isValidElement(icon)
    ? cloneElement(icon as ReactElement<{ strokeWidth?: number }>, { strokeWidth: 1.5 })
    : icon;

  return (
    <button
      type="button"
      className={cn(
        'flex flex-col items-center gap-2 min-w-[64px] transition-transform duration-150 active:scale-[0.97]',
        className,
      )}
      {...props}
    >
      <span className="flex items-center justify-center size-14 rounded-full bg-surface-2 text-text min-h-[44px] min-w-[44px]">
        {iconWithStroke}
      </span>
      <span className="text-caption text-text-muted">{label}</span>
    </button>
  );
}
