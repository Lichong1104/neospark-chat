import type { MediaBlock } from '../types';
import { absolutizeUrl } from './api';

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'avif', 'svg']);
const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov', 'm4v']);
// File extensions we offer as an in-chat card + right-hand preview. Office and
// archive formats are included so they still open from a click, even though the
// panel can only offer a download for them.
const FILE_EXTS = new Set([
  'json', 'md', 'markdown', 'txt', 'csv', 'tsv', 'log', 'yaml', 'yml', 'xml', 'html', 'htm',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'gz', 'tar',
  'css', 'scss', 'less', 'js', 'jsx', 'ts', 'tsx', 'py', 'sh', 'bash', 'sql', 'ini',
  'toml', 'env', 'conf', 'java', 'go', 'rs', 'c', 'cpp', 'h', 'rb', 'php', 'swift', 'kt',
]);

const BARE_URL_RE =
  /(^|[^\]("'=<`])((?:\/uploads\/|https?:\/\/)[^\s<>()"'`]*?\.(?:png|jpe?g|gif|webp|bmp|avif|svg|mp4|webm|mov|m4v|json|md|markdown|txt|csv|tsv|log|yaml|yml|xml|html|htm|pdf|docx?|xlsx?|pptx?|zip|gz|tar|css|js|ts|py|sh|sql)(?:[?#][^\s<>()"'`]*)?)(?=$|[\s，。、；：！？)\]`"'])/gi;

export type PreviewKind = 'image' | 'video' | 'markdown' | 'json' | 'text' | 'pdf' | 'other';

const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;

export function assetPath(url: string): string {
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return url;
  }
}

export function assetExtension(url: string): string {
  const path = assetPath(url).split(/[?#]/)[0];
  const dot = path.lastIndexOf('.');
  return dot >= 0 ? path.slice(dot + 1).toLowerCase() : '';
}

function extOf(urlOrName: string): string {
  const clean = urlOrName.split(/[?#]/)[0];
  const dot = clean.lastIndexOf('.');
  return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : '';
}

/** Classify a URL (or filename) into the kind of asset it points at. */
export function mediaKind(urlOrName: string): MediaBlock['type'] | null {
  const ext = extOf(urlOrName);
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (VIDEO_EXTS.has(ext)) return 'video';
  if (FILE_EXTS.has(ext)) return 'file';
  return null;
}

export function previewKind(asset: MediaBlock): PreviewKind {
  const ext = assetExtension(asset.url) || extOf(asset.filename ?? '');
  const mime = (asset.mime ?? '').toLowerCase();
  if (asset.type === 'image' || mime.startsWith('image/') || IMAGE_EXTS.has(ext)) return 'image';
  if (asset.type === 'video' || mime.startsWith('video/') || VIDEO_EXTS.has(ext)) return 'video';
  if (ext === 'md' || ext === 'markdown' || mime === 'text/markdown') return 'markdown';
  if (ext === 'json' || mime === 'application/json') return 'json';
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
  if (FILE_EXTS.has(ext) || mime.startsWith('text/')) return 'text';
  return 'other';
}

export async function fetchAssetText(url: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(url, { credentials: 'omit', signal });
  if (!res.ok) throw new Error(`Unable to load file (${res.status})`);
  const length = Number(res.headers.get('content-length') ?? 0);
  if (length > MAX_PREVIEW_BYTES) throw new Error('File is too large to preview');
  const text = await res.text();
  return text.length > MAX_PREVIEW_BYTES ? `${text.slice(0, MAX_PREVIEW_BYTES)}\n…` : text;
}

/**
 * Collect previewable assets for an assistant message.
 *
 * Structured `media` blocks are authoritative when present. The text can still
 * carry the same links (the backend derives persisted content from its blocks,
 * and older messages may only have markdown), so links and bare URLs are lifted
 * into cards and removed from the rendered text to avoid showing them twice.
 * The `<generated_files>` memory block is hidden as well.
 */
export function normalizeMessageContent(
  content: string,
  existingMedia: MediaBlock[] = [],
): { text: string; media: MediaBlock[] } {
  const media: MediaBlock[] = [];
  const seen = new Set<string>();

  for (const block of existingMedia) {
    if (!block.url) continue;
    const key = assetPath(block.url);
    if (seen.has(key)) continue;
    seen.add(key);
    media.push(block);
  }

  const add = (rawUrl: string, filename?: string, forceKind?: MediaBlock['type']) => {
    const url = absolutizeUrl(rawUrl);
    if (!url) return;
    const key = assetPath(url);
    if (seen.has(key)) return;
    const kind = forceKind ?? mediaKind(url) ?? mediaKind(filename ?? '');
    if (!kind) return;
    seen.add(key);
    media.push({ type: kind, url, filename: filename?.trim() || undefined });
  };

  let text = content || '';

  text = text.replace(/<generated_files>([\s\S]*?)<\/generated_files>/gi, (_match, body: string) => {
    for (const line of body.split('\n')) {
      const sep = line.indexOf(':');
      if (sep <= 0) continue;
      const name = line.slice(0, sep).trim();
      const url = line.slice(sep + 1).trim();
      if (url && (/^https?:\/\//i.test(url) || url.startsWith('/'))) add(url, name);
    }
    return '';
  });

  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (match, alt: string, url: string) => {
    const kind = mediaKind(url);
    if (!kind) return match;
    add(url, alt.trim() || undefined, kind);
    return '';
  });

  text = text.replace(
    /(^|[^!])\[([^\]]*)\]\(([^)\s]+)\)/g,
    (match, prefix: string, label: string, url: string) => {
      const kind = mediaKind(url);
      if (!kind) return match;
      add(url, label.trim() || undefined, kind);
      return prefix;
    },
  );

  text = text.replace(BARE_URL_RE, (match, prefix: string, url: string) => {
    const kind = mediaKind(url);
    if (!kind) return match;
    add(url, undefined, kind);
    return prefix;
  });

  text = text
    .replace(/`\s*`/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');

  return { text: text.trim(), media };
}
