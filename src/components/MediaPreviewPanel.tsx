import { useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, FileText, Play, X } from 'lucide-react';
import type { MediaBlock } from '../types';
import { cn } from '../lib/utils';

/**
 * Right-hand preview with one tab per generated asset. Media renders from
 * structured blocks, so the same block set feeds both the inline grid and this
 * panel — opening any tile in the conversation shows the full gallery.
 */
export default function MediaPreviewPanel({
  items,
  activeUrl,
  onSelect,
  onClose,
}: {
  items: MediaBlock[];
  activeUrl: string;
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const index = useMemo(() => {
    const found = items.findIndex((item) => item.url === activeUrl);
    return found >= 0 ? found : 0;
  }, [items, activeUrl]);
  const active = items[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (items.length < 2) return;
      if (e.key === 'ArrowRight') onSelect(items[(index + 1) % items.length].url);
      if (e.key === 'ArrowLeft') onSelect(items[(index - 1 + items.length) % items.length].url);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [items, index, onSelect, onClose]);

  if (!active) return null;

  const label = active.filename || (active.type === 'video' ? 'Generated video' : 'Generated image');
  const step = (delta: number) => onSelect(items[(index + delta + items.length) % items.length].url);

  return (
    <aside
      aria-label="Media preview"
      className="fixed inset-0 z-50 flex flex-col bg-surface lg:static lg:z-auto lg:h-full lg:w-[clamp(20rem,36vw,35rem)] lg:flex-none lg:border-l lg:border-line"
    >
      <header className="flex items-center gap-1.5 border-b border-line px-3 py-2.5 sm:px-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-2">
            {active.type === 'video' ? 'Video preview' : 'Image preview'}
            {items.length > 1 ? (
              <span className="ml-1.5 font-semibold normal-case tracking-normal text-muted-2">
                {index + 1}/{items.length}
              </span>
            ) : null}
          </p>
          <p className="truncate text-sm font-semibold text-ink">{label}</p>
        </div>
        <a
          href={active.url}
          target="_blank"
          rel="noopener noreferrer"
          className="icon-btn"
          title="Open original"
          aria-label="Open original"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
        <button type="button" onClick={onClose} className="icon-btn" title="Close preview" aria-label="Close preview">
          <X className="h-4 w-4" />
        </button>
      </header>

      {items.length > 1 ? (
        <div
          role="tablist"
          aria-label="Generated media"
          className="flex flex-none gap-2 overflow-x-auto border-b border-line px-3 py-2.5"
        >
          {items.map((item, i) => (
            <button
              key={item.url}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={item.filename || `${item.type} ${i + 1}`}
              onClick={() => onSelect(item.url)}
              className={cn(
                'relative h-14 w-14 flex-none overflow-hidden rounded-lg border bg-paper transition-colors',
                i === index ? 'border-ink ring-2 ring-ink/15' : 'border-line hover:border-muted-2',
              )}
            >
              {item.type === 'image' ? (
                <img src={item.url} alt="" className="h-full w-full object-cover" />
              ) : item.type === 'video' ? (
                <>
                  <video
                    src={`${item.url}#t=0.1`}
                    muted
                    playsInline
                    preload="metadata"
                    className="pointer-events-none h-full w-full object-cover"
                  />
                  <span className="absolute inset-0 grid place-items-center bg-ink/25">
                    <Play className="h-4 w-4 fill-white text-white" />
                  </span>
                </>
              ) : (
                <span className="grid h-full w-full place-items-center text-muted-2">
                  <FileText className="h-5 w-5" />
                </span>
              )}
            </button>
          ))}
        </div>
      ) : null}

      <div className="relative grid min-h-0 flex-1 place-items-center overflow-auto bg-paper p-4">
        {active.type === 'video' ? (
          <video
            key={active.url}
            src={active.url}
            controls
            playsInline
            className="max-h-full w-auto max-w-full rounded-xl border border-line-soft bg-ink"
          />
        ) : (
          <img
            key={active.url}
            src={active.url}
            alt={label}
            className="max-h-full w-auto max-w-full rounded-xl border border-line-soft bg-surface object-contain"
          />
        )}
        {items.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous media"
              className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface/90 text-ink shadow-card transition-colors hover:border-ink"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next media"
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface/90 text-ink shadow-card transition-colors hover:border-ink"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        ) : null}
      </div>
    </aside>
  );
}
