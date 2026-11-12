import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Message } from '../components/Message';
import PreviewPanel from '../components/PreviewPanel';
import { BrandMark } from '../components/Sidebar';
import { useAuth } from '../auth/AuthContext';
import { forkSharedSession, getSharedView } from '../lib/api';
import type { MediaBlock, Message as ChatMessage } from '../types';

const POLL_INTERVAL_MS = 5000;

type ViewState = 'loading' | 'ready' | 'not-found' | 'error';

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const { user, openLogin } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<ViewState>('loading');
  const [title, setTitle] = useState('Shared chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [indexable, setIndexable] = useState(false);
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<MediaBlock | null>(null);
  const [draft, setDraft] = useState('');
  const [forking, setForking] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);
  const forkingRef = useRef(false);
  /** Message typed before the login modal opened; sent once the user signs in. */
  const pendingRef = useRef<string | null>(null);

  const refetch = useCallback(async () => {
    if (!token) {
      setState('not-found');
      return;
    }
    try {
      const view = await getSharedView(token);
      setTitle(view.title);
      setMessages(view.messages);
      setIndexable(view.indexable);
      setSkillIds(view.skillIds);
      setState('ready');
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 410) setState('not-found');
      else setState((prev) => (prev === 'ready' ? prev : 'error'));
    }
  }, [token]);

  // Live view: poll while the tab is visible so new turns show up without a
  // manual refresh.
  useEffect(() => {
    void refetch();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !forkingRef.current) void refetch();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refetch]);

  useEffect(() => {
    document.title = state === 'ready' ? `${title} — NeoSpark` : 'Shared chat — NeoSpark';
  }, [state, title]);

  // Shared pages stay out of search engines unless the owner explicitly enabled
  // indexing for this share.
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const created = !meta;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    meta.content = state === 'ready' && indexable ? 'index,follow' : 'noindex,nofollow';
    return () => {
      if (created) meta.remove();
    };
  }, [state, indexable]);

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

  const forkAndSend = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || forkingRef.current || !token) return;
      if (skillIds.length === 0) {
        toast('This conversation has no skill attached');
        return;
      }

      forkingRef.current = true;
      setForking(true);
      setDraft('');
      try {
        const forked = await forkSharedSession(token);
        navigate('/', {
          state: {
            openSessionId: forked.sessionId,
            autoMessage: content,
            skillIds: forked.skillIds,
            model: forked.model,
          },
        });
      } catch (e) {
        setDraft(content);
        toast((e as Error).message || 'Failed to copy this conversation');
      } finally {
        forkingRef.current = false;
        setForking(false);
      }
    },
    [token, skillIds, navigate],
  );

  const handleSend = () => {
    const text = draft.trim();
    if (!text || forking) return;
    if (!user) {
      pendingRef.current = text;
      openLogin();
      return;
    }
    void forkAndSend(text);
  };

  // The login modal lives at the app root, so signing in never leaves this
  // page. Once authenticated, fork the chat and send the pending message.
  useEffect(() => {
    if (!user) return;
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    void forkAndSend(pending);
  }, [user, forkAndSend]);

  return (
    <div className="flex h-full overflow-hidden">
      <main className="relative flex h-full min-w-0 flex-1 flex-col">
        <header className="border-b border-line bg-surface/70 px-3 py-2.5 backdrop-blur sm:px-6 sm:py-3">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-1.5 sm:gap-3">
            <Link to="/" className="flex flex-none items-center gap-2 text-base font-bold leading-tight tracking-tight text-ink">
              <BrandMark />
              NeoSpark
            </Link>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold tracking-tight">{title}</div>
              <div className="truncate text-xs text-muted-2">Shared conversation</div>
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
                  <Message key={m.id} message={m} onConfirmSelect={() => {}} onPreview={setPreview} disabled={forking} />
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

        {state === 'ready' && (
          <div className="border-t border-line bg-surface/70 px-3 py-3 backdrop-blur sm:px-6 sm:py-4">
            <div className="mx-auto w-full max-w-6xl">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Continue with your own copy…"
                disabled={forking}
                rows={3}
                className="max-h-56 min-h-20 w-full resize-none whitespace-pre-wrap break-words bg-transparent px-2 py-1.5 text-base leading-relaxed outline-none focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!draft.trim() || forking}
                  aria-label="Copy conversation and send"
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-ink text-surface shadow-[0_1px_2px_rgba(10,10,10,.3),0_8px_18px_-8px_rgba(10,10,10,.5)] transition-transform duration-200 hover:scale-105 disabled:scale-100 disabled:opacity-30"
                >
                  {forking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-2">
                <span className={user ? undefined : 'hint-blink'}>
                  {user ? 'Enter to send · a copy will be added to your chats' : 'Sign in to continue with your own copy'}
                </span>
                <span>{forking ? 'Copying conversation…' : null}</span>
              </div>
            </div>
          </div>
        )}
      </main>
      {preview ? <PreviewPanel asset={preview} onClose={() => setPreview(null)} /> : null}
    </div>
  );
}
