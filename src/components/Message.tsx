import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, FileText, Maximize2, MoveHorizontal, Play } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../auth/AuthContext';
import type { MediaBlock, Message as ChatMessage } from '../types';
import { assetExtension, normalizeMessageContent } from '../lib/media';
import { cn } from '../lib/utils';

const MIN_MEDIA_SIZE = 112;
const MAX_MEDIA_SIZE = 448;

/* Inline image/video thumbnail. A corner grip resizes it horizontally between
   the bounds above, so large renders can be inspected without opening the
   preview panel. */
function MediaThumb({
  block,
  kind,
  onPreview,
  children,
}: {
  block: MediaBlock;
  kind: 'image' | 'video';
  onPreview: (asset: MediaBlock) => void;
  children: React.ReactNode;
}) {
  const [size, setSize] = useState(128);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; size: number } | null>(null);

  const startDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    drag.current = { x: e.clientX, size };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const dragMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    setSize(
      Math.min(MAX_MEDIA_SIZE, Math.max(MIN_MEDIA_SIZE, drag.current.size + (e.clientX - drag.current.x))),
    );
  };
  const endDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    drag.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="group relative max-w-full" style={{ width: size, height: size }}>
      <button
        type="button"
        onClick={() => onPreview(block)}
        aria-label={`Preview ${block.filename || kind}`}
        className={cn(
          'h-full w-full overflow-hidden rounded-lg border border-line-soft bg-paper transition-colors hover:border-ink',
          kind === 'video' && 'bg-ink',
        )}
      >
        {children}
      </button>
      <button
        type="button"
        aria-label="Resize"
        title="Drag to resize"
        onPointerDown={startDrag}
        onPointerMove={dragMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={dragging ? { opacity: 1 } : undefined}
        className="hover-reveal absolute bottom-1 right-1 z-10 flex h-6 w-6 cursor-ew-resize touch-none items-center justify-center rounded-md bg-ink/60 text-surface transition-opacity hover:bg-ink/80"
      >
        <MoveHorizontal className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

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

function ThinkingDots() {
  return (
    <span className="thinking-dots" aria-label="Thinking">
      <span />
      <span />
      <span />
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        toast.error('Copy failed — select the text and copy it manually');
        return;
      }
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      title={copied ? 'Copied' : 'Copy'}
      aria-label={copied ? 'Copied' : 'Copy message'}
      className="hover-reveal flex h-7 w-7 flex-none items-center justify-center rounded-lg text-muted-2 transition-colors hover:bg-line-soft hover:text-ink"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function Message({
  message,
  onConfirmSelect,
  onPreview,
  disabled = false,
}: {
  message: ChatMessage;
  onConfirmSelect: (option: string) => void;
  onPreview: (asset: MediaBlock) => void;
  disabled?: boolean;
}) {
  if (message.role === 'user') {
    return (
      <div className="group animate-fade-up flex justify-end gap-2.5">
        <div className="max-w-[88%] rounded-2xl rounded-br-md bg-ink px-4 py-3 shadow-[0_1px_2px_rgba(10,10,10,.16),0_10px_22px_-10px_rgba(10,10,10,.5)] sm:max-w-[75%]">
          <p className="whitespace-pre-wrap break-words text-base leading-relaxed text-surface">
            {message.content}
          </p>
        </div>
        <div className="flex flex-none flex-col items-center gap-1.5">
          <UserAvatar />
          <CopyButton text={message.content} />
        </div>
      </div>
    );
  }

  const { text: displayContent, media } = normalizeMessageContent(message.content, message.media ?? []);
  const showThinking = message.streaming && !displayContent && media.length === 0;

  return (
    <div className="group animate-fade-up flex items-start gap-3">
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

        {!message.streaming && displayContent ? (
          <div className="flex justify-start">
            <CopyButton text={displayContent} />
          </div>
        ) : null}

        {media.length > 0 ? (
          <div className="flex flex-wrap items-start gap-2">
            {media.map((block) => {
              if (block.type === 'image') {
                return (
                  <MediaThumb key={block.url} block={block} kind="image" onPreview={onPreview}>
                    <img
                      src={block.url}
                      alt={block.filename || 'Generated image'}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                    <span className="absolute inset-0 grid place-items-center bg-ink/0 text-surface opacity-0 transition-all group-hover:bg-ink/30 group-hover:opacity-100">
                      <Maximize2 className="h-4 w-4" />
                    </span>
                  </MediaThumb>
                );
              }
              if (block.type === 'video') {
                return (
                  <MediaThumb key={block.url} block={block} kind="video" onPreview={onPreview}>
                    <video
                      src={`${block.url}#t=0.1`}
                      muted
                      playsInline
                      preload="metadata"
                      className="pointer-events-none h-full w-full object-cover"
                    />
                    <span className="absolute inset-0 grid place-items-center bg-ink/25 transition-colors group-hover:bg-ink/40">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 text-ink shadow-card">
                        <Play className="h-3.5 w-3.5 fill-ink" />
                      </span>
                    </span>
                  </MediaThumb>
                );
              }
              const ext = assetExtension(block.url) || assetExtension(block.filename ?? '');
              return (
                <button
                  key={block.url}
                  type="button"
                  onClick={() => onPreview(block)}
                  aria-label={`Preview ${block.filename || 'file'}`}
                  className="group flex w-56 max-w-full items-center gap-2 rounded-lg border border-line-soft bg-paper px-2.5 py-2 text-left transition-colors hover:border-ink"
                >
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-line-soft text-muted-2">
                    <FileText className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink-2">
                      {block.filename || 'Generated file'}
                    </span>
                    <span className="block text-micro font-bold uppercase tracking-[0.12em] text-muted-2">
                      {ext || 'FILE'}
                    </span>
                  </span>
                  <Maximize2 className="h-3.5 w-3.5 flex-none text-muted-2 opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
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
                        done ? 'bg-ink text-surface' : active ? 'bg-orange/20 text-orange-ink' : 'bg-line-soft text-muted-2',
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

        {message.streaming && displayContent ? <span className="stream-cursor" /> : null}
      </div>
    </div>
  );
}
