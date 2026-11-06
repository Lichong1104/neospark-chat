import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ExternalLink, FileText, Loader2, X } from 'lucide-react';
import type { MediaBlock } from '../types';
import { assetExtension, fetchAssetText, previewKind } from '../lib/media';
import type { PreviewKind } from '../lib/media';

const KIND_LABEL: Record<PreviewKind, string> = {
  image: 'Image',
  video: 'Video',
  markdown: 'Markdown',
  json: 'JSON',
  text: 'Text',
  pdf: 'PDF',
  other: 'File',
};

/**
 * Right-hand asset viewer. Images and videos render directly; text-like files
 * are fetched and shown in place, with Markdown rendered and JSON pretty-
 * printed. Anything the browser cannot render gets a download / open link.
 */
export default function PreviewPanel({
  asset,
  onClose,
}: {
  asset: MediaBlock;
  onClose: () => void;
}) {
  const kind = previewKind(asset);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ext = assetExtension(asset.url) || assetExtension(asset.filename ?? '');
  const label = asset.filename || `Generated ${kind === 'other' ? 'file' : kind}`;
  const typeLabel = ext ? ext.toUpperCase() : KIND_LABEL[kind];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (kind !== 'markdown' && kind !== 'json' && kind !== 'text') return;
    const controller = new AbortController();
    setText(null);
    setError(null);
    fetchAssetText(asset.url, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setText(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError((e as Error).message || 'Failed to load file');
      });
    return () => controller.abort();
  }, [asset.url, kind]);

  const prettyText = useMemo(() => {
    if (text == null) return '';
    if (kind !== 'json') return text;
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }, [kind, text]);

  const loading = (kind === 'markdown' || kind === 'json' || kind === 'text') && text == null && !error;

  return (
    <aside
      aria-label="File preview"
      className="fixed inset-0 z-50 flex flex-col bg-surface lg:static lg:z-auto lg:h-full lg:w-[clamp(22rem,40vw,44rem)] lg:flex-none lg:border-l lg:border-line"
    >
      <header className="flex items-center gap-1.5 border-b border-line px-3 py-2.5 sm:px-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-2">
            {KIND_LABEL[kind]} preview
            <span className="ml-1.5 rounded bg-line-soft px-1 py-0.5 font-semibold normal-case tracking-normal text-muted-2">
              {typeLabel}
            </span>
          </p>
          <p className="truncate text-sm font-semibold text-ink">{label}</p>
        </div>
        <a
          href={asset.url}
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

      {kind === 'image' ? (
        <div className="grid min-h-0 flex-1 place-items-center overflow-auto bg-paper p-4">
          <img
            src={asset.url}
            alt={label}
            className="max-h-full w-auto max-w-full rounded-xl border border-line-soft bg-surface object-contain"
          />
        </div>
      ) : kind === 'video' ? (
        <div className="grid min-h-0 flex-1 place-items-center overflow-auto bg-paper p-4">
          <video
            key={asset.url}
            src={asset.url}
            controls
            playsInline
            className="max-h-full w-auto max-w-full rounded-xl border border-line-soft bg-ink"
          />
        </div>
      ) : kind === 'pdf' ? (
        <iframe
          src={asset.url}
          title={label}
          className="min-h-0 flex-1 border-0 bg-paper"
        />
      ) : loading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center bg-paper">
          <Loader2 className="h-6 w-6 animate-spin text-muted-2" />
        </div>
      ) : error ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-paper px-6 text-center">
          <FileText className="h-8 w-8 text-muted-2" />
          <p className="text-sm font-semibold text-ink-2">Unable to load this file</p>
          <p className="text-xs text-muted-2">{error}</p>
          <a
            href={asset.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-2 transition-colors hover:border-ink hover:text-ink"
          >
            Open original
          </a>
        </div>
      ) : kind === 'markdown' ? (
        <div className="min-h-0 flex-1 overflow-auto bg-surface px-5 py-4">
          <div className="markdown-body text-sm">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                table: ({ node: _node, ...props }) => (
                  <div className="markdown-table-wrap">
                    <table {...props} />
                  </div>
                ),
              }}
            >
              {text ?? ''}
            </ReactMarkdown>
          </div>
        </div>
      ) : kind === 'json' || kind === 'text' ? (
        <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words bg-paper p-4 font-mono text-xs leading-relaxed text-ink-2">
          {prettyText}
        </pre>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-paper px-6 text-center">
          <FileText className="h-8 w-8 text-muted-2" />
          <p className="text-sm font-semibold text-ink-2">This file type can't be previewed here</p>
          <p className="max-w-xs text-xs text-muted-2">Open the original file to view or download it.</p>
          <a
            href={asset.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-2 transition-colors hover:border-ink hover:text-ink"
          >
            Open original
          </a>
        </div>
      )}
    </aside>
  );
}
