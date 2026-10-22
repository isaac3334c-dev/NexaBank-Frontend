import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/shared/lib/cn';

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function BottomSheet({ open, onOpenChange, title, children, className }: BottomSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 motion-reduce:transition-none"
        />
        <Dialog.Content
          className={cn(
            // rounded-t-[var(--radius-sheet)]: 28px top corners per the
            // Obsidiana y Lima shape scale. The shadow here is structural
            // (it's the only way to visually "lift" a sheet off the page
            // content behind it on a dark bg where a border alone wouldn't
            // read as elevation) rather than decorative, and is kept subtle.
            'safe-bottom fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-[480px] rounded-t-[var(--radius-sheet)] bg-surface px-5 pt-3 pb-6 shadow-[var(--shadow-md)] outline-none',
            // Spring/overshoot entrance (cubic-bezier(.34,1.56,.64,1)) instead
            // of the standard app-wide ease, so sheets feel like they settle
            // into place rather than just ease in flatly.
            'transition-transform duration-320 ease-[cubic-bezier(.34,1.56,.64,1)] motion-reduce:transition-none',
            'data-[state=closed]:translate-y-full data-[state=open]:translate-y-0',
            className,
          )}
        >
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border" aria-hidden="true" />
          {title && (
            <Dialog.Title className="text-h3 text-text mb-3">{title}</Dialog.Title>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
