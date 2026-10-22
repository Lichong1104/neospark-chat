import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FileText } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import type { Message as ChatMessage } from '../types';
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
    <div className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-orange/15 text-xs font-bold text-orange-deep">
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

export function Message({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="animate-fade-up flex justify-end gap-2.5">
        <div className="max-w-[82%] rounded-2xl rounded-br-md bg-ink px-4 py-3 shadow-[0_1px_2px_rgba(10,10,10,.16),0_10px_22px_-10px_rgba(10,10,10,.5)]">
          <p className="whitespace-pre-wrap break-words text-[0.95rem] leading-relaxed text-white">
            {message.content}
          </p>
        </div>
        <UserAvatar />
      </div>
    );
  }

  const media = message.media ?? [];
  const showThinking = message.streaming && !message.content && media.length === 0;

  return (
    <div className="animate-fade-up flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full border border-line bg-surface shadow-card">
        <RingMark className="h-4 w-4" />
      </div>
      <div className="min-w-0 max-w-[82%]">
        <div
          className={cn(
            'rounded-2xl rounded-tl-md border border-line-soft bg-surface px-4 py-3 shadow-card',
            message.streaming && 'border-dashed border-orange/40',
          )}
        >
          {message.content ? (
            <div className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          ) : showThinking ? (
            <ThinkingDots />
          ) : null}

          {media.length > 0 ? (
            <div className={cn('grid gap-3', media.length === 1 ? '' : 'grid-cols-2', message.content && 'mt-3')}>
              {media.map((block, i) => {
                if (block.type === 'image') {
                  return (
                    <img
                      key={i}
                      src={block.url}
                      alt={block.filename || 'Generated image'}
                      loading="lazy"
                      className="w-full rounded-xl border border-line-soft object-cover"
                    />
                  );
                }
                if (block.type === 'video') {
                  return <video key={i} src={block.url} controls className="w-full rounded-xl border border-line-soft" />;
                }
                return (
                  <a
                    key={i}
                    href={block.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-xl border border-line-soft bg-paper px-3 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-ink"
                  >
                    <FileText className="h-4 w-4 flex-none text-muted-2" />
                    <span className="truncate">{block.filename || 'Download file'}</span>
                  </a>
                );
              })}
            </div>
          ) : null}

          {message.streaming && message.content ? <span className="stream-cursor" /> : null}
        </div>
      </div>
    </div>
  );
}
