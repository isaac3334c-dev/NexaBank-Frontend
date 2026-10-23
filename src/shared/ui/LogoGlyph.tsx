import { cn } from '@/shared/lib/cn';

interface LogoGlyphProps {
  /** Overall size in px (square). */
  size?: number;
  className?: string;
}

/**
 * The bare NexaBank "N" wordmark — a hollow, glowing neon outline, no filled
 * background shape. This is a hand-built SVG path (NOT a stroked font
 * glyph): stroking an actual font character's outline (`-webkit-text-stroke`
 * or SVG `<text>` + `stroke`) produces visible doubled/overlapping lines at
 * the diagonal↔vertical joints, because a font glyph's own outline is a
 * composite path, not a single simple polygon — the browser's stroke
 * renderer self-intersects at tight angles. A single hand-drawn,
 * non-self-intersecting polygon strokes cleanly with `stroke-linejoin`
 * instead. This also makes the mark font-independent (renders identically
 * regardless of whether the Geist webfont has loaded yet).
 *
 * `BrandMark` (the filled rounded-square app icon) is a separate,
 * intentionally different representation used for actual OS/PWA icon
 * contexts (manifest, home screen), which require a solid background shape.
 */
export function LogoGlyph({ size = 72, className }: LogoGlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={cn(
        '[filter:drop-shadow(0_0_5px_var(--color-primary))_drop-shadow(0_0_11px_var(--color-primary))]',
        className,
      )}
    >
      <path
        d="M 14 86 L 14 14 L 28 14 L 72 72 L 72 14 L 86 14 L 86 86 L 72 86 L 28 28 L 28 86 Z"
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth={3.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
