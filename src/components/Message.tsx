import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, FileText, Maximize2, Play } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import type { MediaBlock, Message as ChatMessage } from '../types';
import { cn } from '../lib/utils';

function RingMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="#0a0a0a" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="#fff" strokeWidth="1.4" opacity=".5" />
      <circle cx="16" cy="16" r="4.5" fill="#ffd939" />
    </svg>
  );
}

function UserAvatar() {
  const { user } = useAuth();
  if (user?.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt=""
        referrerPolicy="no-referrer"
        className="mt-0.5 h-7 w-7 flex-none rounded-full object-cover"
      />
    );
  }
  return (
    <div className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-orange/15 text-xs font-bold text-orange-ink">
      {(user?.name || user?.email || '?')[0]?.toUpperCase()}
    </div>
  );
}

function assetPath(url: string): string {
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return url;
  }
}

/**
 * The backend derives `content` from the block list, so every generated asset
 * also appears as markdown inside the text. Rendering that markdown alongside
 * the media grid shows the image twice (and the inline copy points at a
 * relative URL that breaks while streaming). Once media blocks exist, they are
 * the single source of truth — drop their markdown duplicates from the text.
 */
function stripMediaMarkdown(content: string, media: MediaBlock[]): string {
  if (!content || media.length === 0) return content;
  const paths = new Set(media.map((m) => assetPath(m.url)));
  const isMedia = (url: string) => paths.has(assetPath(url));
  return content
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (match, _alt, url: string) => (isMedia(url) ? '' : match))
    .replace(/(^|[^!])\[([^\]]*)\]\(([^)\s]+)\)/g, (match, prefix, _text, url: string) =>
      isMedia(url) ? prefix : match,
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function ThinkingDots() {
  return (
    <span className="thinking-dots" aria-label="Thinking">
      <span />
      <span />
      <span />
    </span>
  );
}

export function Message({
  message,
  onConfirmSelect,
  onPreviewMedia,
  disabled = false,
}: {
  message: ChatMessage;
  onConfirmSelect: (option: string) => void;
  onPreviewMedia: (media: MediaBlock) => void;
  disabled?: boolean;
}) {
  if (message.role === 'user') {
    return (
      <div className="animate-fade-up flex justify-end gap-2.5">
        <div className="max-w-[88%] rounded-2xl rounded-br-md bg-ink px-4 py-3 shadow-[0_1px_2px_rgba(10,10,10,.12),0_6px_16px_-8px_rgba(10,10,10,.3)] sm:max-w-[75%]">
          <p className="whitespace-pre-wrap break-words text-base leading-relaxed text-surface">
            {message.content}
          </p>
        </div>
        <UserAvatar />
      </div>
    );
  }

  const media = message.media ?? [];
  const showThinking = message.streaming && !message.content && media.length === 0;
  const displayContent = stripMediaMarkdown(message.content, media);

  return (
    <div className="animate-fade-up flex items-start gap-3">
      <div className="mt-1 flex h-7 w-7 flex-none items-center justify-center rounded-full border border-line bg-surface shadow-card">
        <RingMark className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        {displayContent ? (
          <div className="markdown-body">
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
              {displayContent}
            </ReactMarkdown>
          </div>
        ) : showThinking ? (
          <ThinkingDots />
        ) : null}

        {media.length > 0 ? (
          <div className={cn('grid gap-3', media.length === 1 ? 'justify-items-start' : 'grid-cols-2 sm:grid-cols-3')}>
            {media.map((block, i) => {
              if (block.type === 'image') {
                const single = media.length === 1;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onPreviewMedia(block)}
                    aria-label={`Preview ${block.filename || 'image'}`}
                    className={cn(
                      'group relative block cursor-zoom-in overflow-hidden rounded-xl border border-line-soft bg-paper',
                      single ? 'max-w-full' : 'aspect-square w-full',
                    )}
                  >
                    <img
                      src={block.url}
                      alt={block.filename || 'Generated image'}
                      loading="lazy"
                      className={cn(
                        'block transition-transform duration-300 group-hover:scale-[1.02]',
                        single ? 'max-h-60 w-auto max-w-full object-contain' : 'h-full w-full object-cover',
                      )}
                    />
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink/0 opacity-0 transition-opacity duration-200 group-hover:bg-ink/15 group-hover:opacity-100">
                      <span className="flex items-center gap-1 rounded-full bg-surface/90 px-2.5 py-1 text-xs font-semibold text-ink shadow-card">
                        <Maximize2 className="h-3 w-3" />
                        View
                      </span>
                    </span>
                  </button>
                );
              }
              if (block.type === 'video') {
                const single = media.length === 1;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onPreviewMedia(block)}
                    aria-label={`Preview ${block.filename || 'video'}`}
                    className={cn(
                      'group relative block cursor-zoom-in overflow-hidden rounded-xl border border-line-soft bg-paper',
                      single ? 'max-w-full' : 'aspect-square w-full',
                    )}
                  >
                    <video
                      src={`${block.url}#t=0.1`}
                      muted
                      playsInline
                      preload="metadata"
                      className={cn(
                        'pointer-events-none block',
                        single ? 'max-h-60 w-auto max-w-full object-contain' : 'h-full w-full object-cover',
                      )}
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-ink/20 transition-colors group-hover:bg-ink/30">
                      <span className="flex items-center gap-1 rounded-full bg-surface/90 px-2.5 py-1 text-xs font-semibold text-ink shadow-card">
                        <Play className="h-3 w-3 fill-ink" />
                        Play
                      </span>
                    </span>
                  </button>
                );
              }
              return (
                <a
                  key={i}
                  href={block.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-line-soft bg-paper px-3 py-2 text-sm font-medium text-ink-2 transition-colors hover:border-ink"
                >
                  <FileText className="h-4 w-4 flex-none text-muted-2" />
                  <span className="truncate">{block.filename || 'Download file'}</span>
                </a>
              );
            })}
          </div>
        ) : null}

        {message.plan && message.plan.length > 0 ? (
          <div className="rounded-xl border border-line bg-paper/60 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-2">Task plan</p>
              {typeof message.stepCompleted === 'number' && message.stepTotal ? (
                <span className="text-xs font-semibold text-muted-2">
                  {message.stepCompleted}/{message.stepTotal}
                </span>
              ) : null}
            </div>
            <ol className="mt-2 space-y-1.5">
              {message.plan.map((step, i) => {
                const done = typeof message.stepCompleted === 'number' && i < message.stepCompleted;
                const active = typeof message.stepCompleted === 'number' && i === message.stepCompleted;
                return (
                  <li key={i} className="flex items-start gap-2">
                    <span
                      className={cn(
                        'mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full text-micro font-bold',
                        done ? 'bg-ink text-surface' : active ? 'bg-orange/25 text-orange-ink ring-1 ring-orange/30' : 'bg-line-soft text-muted-2',
                      )}
                    >
                      {done ? <Check className="h-3 w-3" /> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink-2">{step.skill_name}</span>
                      {step.task ? <span className="block truncate text-xs text-muted-2">{step.task}</span> : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}

        {message.confirm ? (
          <div className="rounded-xl border border-orange/30 bg-orange/[0.06] p-3">
            <p className="text-sm font-semibold text-ink">{message.confirm.question}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {message.confirm.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  disabled={message.streaming || disabled}
                  onClick={() => onConfirmSelect(opt)}
                  className="min-h-9 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink-2 transition-colors hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {message.streaming && message.content ? <span className="stream-cursor" /> : null}
      </div>
    </div>
  );
}
