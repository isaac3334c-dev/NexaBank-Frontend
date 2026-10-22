import type { ComponentType, ReactNode } from 'react';
import { Inbox, AlertTriangle } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  children?: ReactNode;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-12 px-5">
      <span className="flex items-center justify-center size-14 rounded-full bg-surface-2 text-text-muted">
        <Icon className="size-6" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-body-strong text-text">{title}</p>
        {description && <p className="text-caption text-text-muted max-w-[280px]">{description}</p>}
      </div>
      {action && (
        <Button variant="secondary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
      {children}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function ErrorState({
  title = 'Algo salió mal',
  description = 'No pudimos completar la acción. Inténtalo de nuevo.',
  action,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-12 px-5">
      <span className="flex items-center justify-center size-14 rounded-full bg-danger-soft text-danger">
        <AlertTriangle className="size-6" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-body-strong text-text">{title}</p>
        <p className="text-caption text-text-muted max-w-[280px]">{description}</p>
      </div>
      {action && (
        <Button variant="danger" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
