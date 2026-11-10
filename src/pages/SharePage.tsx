import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, Loader2, Sparkles } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Message } from '../components/Message';
import PreviewPanel from '../components/PreviewPanel';
import { getSharedView } from '../lib/api';
import type { MediaBlock, Message as ChatMessage } from '../types';

const POLL_INTERVAL_MS = 5000;

type ViewState = 'loading' | 'ready' | 'not-found' | 'error';

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<ViewState>('loading');
  const [title, setTitle] = useState('Shared chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [preview, setPreview] = useState<MediaBlock | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  const refetch = useCallback(async () => {
    if (!token) {
      setState('not-found');
      return;
    }
    try {
      const view = await getSharedView(token);
      setTitle(view.title);
      setMessages(view.messages);
      setState('ready');
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 410) setState('not-found');
      else setState((prev) => (prev === 'ready' ? prev : 'error'));
    }
  }, [token]);

  // Live read-only view: poll while the tab is visible so new turns from the
  // owner show up without a manual refresh.
  useEffect(() => {
    void refetch();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refetch();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refetch]);

  useEffect(() => {
    document.title = state === 'ready' ? `${title} — NeoSpark` : 'Shared chat — NeoSpark';
  }, [state, title]);

  useEffect(() => {
    const el = listRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    atBottomRef.current = near;
    setAtBottom(near);
  };

  return (
    <div className="flex h-full overflow-hidden">
      <main className="relative flex h-full min-w-0 flex-1 flex-col">
        <header className="border-b border-line bg-surface/70 px-3 py-2.5 backdrop-blur sm:px-6 sm:py-3">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-1.5 sm:gap-3">
            <Link to="/" className="flex flex-none items-center gap-1.5 text-sm font-bold tracking-tight text-ink">
              <Sparkles className="h-4 w-4 text-orange-ink" />
              NeoSpark
            </Link>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold tracking-tight">{title}</div>
              <div className="truncate text-xs text-muted-2">Shared view · read-only</div>
            </div>
            <span className="flex-none rounded-full bg-line-soft px-2.5 py-1 text-micro font-bold uppercase tracking-wide text-muted-2">
              Shared
            </span>
          </div>
        </header>

        <div className="relative min-h-0 flex-1">
          <div ref={listRef} onScroll={handleScroll} className="h-full overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
            {state === 'loading' ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-2" />
              </div>
            ) : state === 'not-found' ? (
              <div className="mx-auto flex max-w-3xl flex-col items-center pt-[15vh] text-center">
                <h1 className="text-2xl font-bold tracking-tight">This link is no longer available</h1>
                <p className="mt-3 text-base text-muted">
                  The shared conversation is invalid or sharing has been disabled by its owner.
                </p>
                <Link
                  to="/"
                  className="mt-6 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-muted shadow-card transition-colors hover:border-ink hover:text-ink"
                >
                  Go to NeoSpark
                </Link>
              </div>
            ) : state === 'error' ? (
              <div className="mx-auto flex max-w-3xl flex-col items-center pt-[15vh] text-center">
                <h1 className="text-2xl font-bold tracking-tight">Failed to load</h1>
                <p className="mt-3 text-base text-muted">Please check your connection and try again.</p>
                <button
                  type="button"
                  onClick={() => {
                    setState('loading');
                    void refetch();
                  }}
                  className="mt-6 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-muted shadow-card transition-colors hover:border-ink hover:text-ink"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 sm:gap-6 lg:w-2/3">
                {messages.map((m) => (
                  <Message key={m.id} message={m} onConfirmSelect={() => {}} onPreview={setPreview} disabled />
                ))}
              </div>
            )}
          </div>
          {state === 'ready' && !atBottom && (
            <button
              type="button"
              onClick={() => {
                atBottomRef.current = true;
                setAtBottom(true);
                listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
              }}
              className="absolute bottom-3 left-1/2 z-10 flex min-h-9 -translate-x-1/2 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink shadow-panel"
            >
              <ArrowDown className="h-3.5 w-3.5" />
              Jump to latest
            </button>
          )}
        </div>
      </main>
      {preview ? <PreviewPanel asset={preview} onClose={() => setPreview(null)} /> : null}
    </div>
  );
}
