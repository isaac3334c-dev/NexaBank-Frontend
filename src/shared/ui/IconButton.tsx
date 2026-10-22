import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/cn';

const iconButtonVariants = cva(
  'inline-flex items-center justify-center rounded-full transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(.2,.8,.2,1)] active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-on-primary hover:bg-primary-hover',
        secondary: 'bg-surface-2 text-text hover:brightness-110',
        ghost: 'bg-transparent text-text hover:bg-surface-2',
        'on-surface': 'bg-text/10 text-text hover:bg-text/15 backdrop-blur-sm',
      },
      size: {
        sm: 'size-9',
        md: 'size-11',
        lg: 'size-14',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
);

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  icon: ReactNode;
  'aria-label': string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, icon, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(iconButtonVariants({ variant, size }), 'min-h-[44px] min-w-[44px]', className)}
        {...props}
      >
        {icon}
      </button>
    );
  },
);

IconButton.displayName = 'IconButton';
