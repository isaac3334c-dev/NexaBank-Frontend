interface BrandMarkProps {
  /** Pixel size (square). */
  size?: number;
  className?: string;
}

/**
 * The NexaBank "N" badge — renders the actual generated app icon
 * (public/icons/icon-192.png) instead of re-deriving the glyph with text,
 * so every place the mark appears in the UI is pixel-identical to the real
 * installed app icon (home screen, browser tab, install prompts).
 */
export function BrandMark({ size = 56, className }: BrandMarkProps) {
  return (
    <img
      src="/icons/icon-192.png"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className={className}
      style={{ width: size, height: size }}
    />
  );
}
