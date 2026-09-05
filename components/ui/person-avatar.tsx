import { createNotionAvatarSvg } from "@/lib/notion-avatar";
import { cn } from "@/utils/cn";

/** Canonical avatar sizes — prefer these over one-off values. */
export const AVATAR_SIZE = {
  sm: 28,
  md: 32,
  lg: 40,
  xl: 48,
  profile: 80,
} as const;

interface PersonAvatarProps {
  name: string;
  size?: number;
  className?: string;
  title?: string;
}

/**
 * Notion-style person mark. Radius is always `rounded-lg` (squircle) —
 * never pass `rounded-full`; it will be overridden for consistency.
 */
export function PersonAvatar({
  name,
  size = AVATAR_SIZE.md,
  className,
  title,
}: PersonAvatarProps) {
  const svg = createNotionAvatarSvg(name, size);
  const label = title ?? name;

  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "shrink-0 overflow-hidden bg-zinc-50 border border-zinc-200 [&>svg]:size-full [&>svg]:block",
        className,
        "rounded-lg",
      )}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
