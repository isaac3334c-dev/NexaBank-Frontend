import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { IconButton } from './IconButton';

export interface AppHeaderProps {
  title?: string;
  onBack?: () => void;
  rightAction?: ReactNode;
  className?: string;
}

export function AppHeader({ title, onBack, rightAction, className }: AppHeaderProps) {
  return (
    <header
      className={cn(
        'safe-top sticky top-0 z-10 flex items-center gap-2 bg-bg/95 backdrop-blur-sm px-5 h-14',
        className,
      )}
    >
      {onBack ? (
        <IconButton
          variant="ghost"
          size="sm"
          icon={<ChevronLeft className="size-5" />}
          aria-label="Volver"
          onClick={onBack}
        />
      ) : (
        <span className="size-9" aria-hidden="true" />
      )}
      <h1 className="flex-1 text-h3 text-text text-center truncate">{title}</h1>
      <div className="flex items-center justify-end min-w-9">{rightAction}</div>
    </header>
  );
}
