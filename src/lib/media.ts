import type { MediaBlock } from '../types';
import { absolutizeUrl } from './api';

const IMAGE_FILE = /\.(png|jpe?g|gif|webp|bmp|avif|svg)$/i;
const VIDEO_FILE = /\.(mp4|webm|mov|m4v)$/i;

/** Path portion of a URL, so relative and absolute forms compare equal. */
export function assetPath(url: string): string {
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return url;
  }
}

export function mediaKind(url: string): 'image' | 'video' | null {
  const clean = url.split(/[?#]/)[0];
  if (IMAGE_FILE.test(clean)) return 'image';
  if (VIDEO_FILE.test(clean)) return 'video';
  return null;
}

/**
 * The backend copies generated asset URLs into the assistant text — markdown
 * images/links plus a memory-only `<generated_files>` block — and the block
 * list is not always present in what reaches the client. Rebuild the display
 * from both sources: promote every usable URL to a media tile, drop its inline
 * duplicate, and hide the memory block. That way an uploaded image still
 * renders even when the media blocks were dropped or the client only got text.
 */
export function normalizeAssistantContent(
  content: string,
  existingMedia: MediaBlock[] = [],
): { text: string; media: MediaBlock[] } {
  const media = [...existingMedia];
  const seen = new Set(media.map((block) => assetPath(block.url)));

  const add = (rawUrl: string, filename?: string) => {
    const url = absolutizeUrl(rawUrl);
    const type = mediaKind(url);
    if (!type || seen.has(assetPath(url))) return;
    seen.add(assetPath(url));
    media.push({ type, url, filename });
  };

  let text = content;

  text = text.replace(/<generated_files>([\s\S]*?)<\/generated_files>/gi, (_match, body: string) => {
    for (const line of body.split('\n')) {
      const url = line.slice(line.indexOf(':') + 1).trim();
      if (url.startsWith('/') || /^https?:\/\//i.test(url)) add(url);
    }
    return '';
  });

  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (match, alt: string, url: string) => {
    if (!mediaKind(absolutizeUrl(url))) return match;
    add(url, alt.trim() || undefined);
    return '';
  });

  // Drop links that only repeat an asset already rendered as a tile.
  text = text.replace(
    /(^|[^!])\[([^\]]*)\]\(([^)\s]+)\)/g,
    (match, prefix: string, _label: string, url: string) =>
      seen.has(assetPath(absolutizeUrl(url))) ? prefix : match,
  );

  // The backend rewrites local output filenames to bare `/uploads/...` URLs in
  // the prose ("saved as /uploads/…/plate.png"). Promote those too, so a text
  // path never stands in for a picture. The preceding-char guard keeps this
  // from re-matching URLs inside markdown/HTML syntax.
  text = text.replace(
    /(^|[^\]("'=<])((?:\/uploads\/|https?:\/\/)[^\s<>()"'`]*?\.(?:png|jpe?g|gif|webp|bmp|avif|svg|mp4|webm|mov|m4v)(?:[?#][^\s<>()"'`]*)?)(?=$|[\s，。、；：！？)\]`"'])/gi,
    (match, prefix: string, url: string) => {
      if (!mediaKind(url)) return match;
      add(url);
      return prefix;
    },
  );

  text = text
    .replace(/`\s*`/g, '')
    .replace(/\s+([。，、；：！？])/g, '$1')
    .replace(/\n{3,}/g, '\n\n');

  return { text: text.trim(), media };
}
