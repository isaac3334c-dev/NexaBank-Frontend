import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/cn';

const avatarVariants = cva(
  'inline-flex items-center justify-center rounded-full bg-primary-soft text-primary font-semibold shrink-0 overflow-hidden',
  {
    variants: {
      size: {
        sm: 'size-9 text-[13px]',
        md: 'size-11 text-[15px]',
        lg: 'size-14 text-[18px]',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
);

export interface AvatarProps extends VariantProps<typeof avatarVariants> {
  name: string;
  imageUrl?: string;
  className?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, imageUrl, size, className }: AvatarProps) {
  return (
    <span className={cn(avatarVariants({ size }), className)}>
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="size-full object-cover" />
      ) : (
        <span aria-hidden="true">{getInitials(name)}</span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}
