import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/cn';

const cardVariants = cva('rounded-[var(--radius-card)] p-4', {
  variants: {
    variant: {
      surface: 'bg-surface',
      elevated: 'bg-surface shadow-[var(--shadow-md)]',
      outlined: 'bg-surface border border-border',
    },
  },
  defaultVariants: {
    variant: 'surface',
  },
});

export interface CardProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

export function Card({ className, variant, ...props }: CardProps) {
  return <div className={cn(cardVariants({ variant }), className)} {...props} />;
}
