import { useEffect } from 'react';
import { ExternalLink, X } from 'lucide-react';
import type { MediaBlock } from '../types';

export default function ImagePreviewPanel({
  image,
  onClose,
}: {
  image: MediaBlock;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const label = image.filename || 'Generated image';

  return (
    <aside className="fixed inset-0 z-50 flex flex-col bg-surface lg:static lg:z-auto lg:h-full lg:w-[clamp(20rem,36vw,35rem)] lg:flex-none lg:border-l lg:border-line">
      <header className="flex items-center gap-1.5 border-b border-line px-3 py-2.5 sm:px-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-2">Image preview</p>
          <p className="truncate text-sm font-semibold text-ink">{label}</p>
        </div>
        <a
          href={image.url}
          target="_blank"
          rel="noopener noreferrer"
          className="icon-btn"
          title="Open original"
          aria-label="Open original"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
        <button
          type="button"
          onClick={onClose}
          className="icon-btn"
          title="Close preview"
          aria-label="Close preview"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="grid min-h-0 flex-1 place-items-center overflow-auto bg-paper p-4">
        <img
          src={image.url}
          alt={label}
          className="max-h-full w-auto max-w-full rounded-xl border border-line-soft bg-surface object-contain"
        />
      </div>
    </aside>
  );
}
