import { Avatar, Style } from "@dicebear/core";
import notionists from "@dicebear/styles/notionists.json";

let notionistsStyle: Style | null = null;
const svgCache = new Map<string, string>();

function getNotionistsStyle() {
  if (!notionistsStyle) {
    notionistsStyle = new Style(notionists);
  }
  return notionistsStyle;
}

export function createNotionAvatarSvg(seed: string, size: number) {
  const cacheKey = `${seed}:${size}`;
  const cached = svgCache.get(cacheKey);
  if (cached) return cached;

  const avatar = new Avatar(getNotionistsStyle(), { seed, size });
  const svg = avatar.toString();
  svgCache.set(cacheKey, svg);
  return svg;
}
