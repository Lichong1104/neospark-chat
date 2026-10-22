import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, LogOut, MessageSquare, Pin, Plus, Trash2, User } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import type { ModelOption, Session, Skill } from '../types';
import { cn } from '../lib/utils';

interface SidebarProps {
  skills: Skill[];
  selectedSkills: string[];
  onToggleSkill: (id: string) => void;
  models: ModelOption[];
  model: string;
  onModelChange: (id: string) => void;
  sessions: Session[];
  activeId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onPinSession: (id: string, pinned: boolean) => void;
  onNewChat: () => void;
}

function BrandMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="#0a0a0a" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="#fff" strokeWidth="1.4" opacity=".5" />
      <circle cx="16" cy="16" r="4.5" fill="#ffd939" />
    </svg>
  );
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const DAY = 86400000;

export default function Sidebar({
  skills,
  selectedSkills,
  onToggleSkill,
  models,
  model,
  onModelChange,
  sessions,
  activeId,
  onSelectSession,
  onDeleteSession,
  onPinSession,
  onNewChat,
}: SidebarProps) {
  const { user, isLoading, openLogin, signOut } = useAuth();
  const [modelOpen, setModelOpen] = useState(false);
  const modelRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    if (!modelOpen) return;
    const onDown = (e: MouseEvent) => {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) setModelOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModelOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [modelOpen]);

  const modelLabel = model ? models.find((m) => m.id === model)?.label ?? model : 'Auto (skill default)';

  const groups = useMemo(() => {
    const now = Date.now();
    const pinned: Session[] = [];
    const recent: Session[] = [];
    const month: Session[] = [];
    const older: Session[] = [];
    for (const s of sessions) {
      const age = now - s.updatedAt;
      if (s.pinned) pinned.push(s);
      else if (age < 7 * DAY) recent.push(s);
      else if (age < 30 * DAY) month.push(s);
      else older.push(s);
    }
    return [
      { key: 'pinned', label: 'Pinned', items: pinned },
      { key: 'recent', label: 'Recent', items: recent },
      { key: 'month', label: 'Last month', items: month },
      { key: 'older', label: 'Earlier', items: older },
    ];
  }, [sessions]);

  const toggleGroup = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const confirmDelete = () => {
    if (pendingDelete) {
      onDeleteSession(pendingDelete.id);
      setPendingDelete(null);
    }
  };

  return (
    <>
      <aside className="flex h-full w-72 flex-none flex-col border-r border-line bg-surface">
        {/* Brand + new chat */}
        <div className="flex items-center gap-2.5 px-4 pb-3 pt-5">
          <BrandMark />
          <div className="min-w-0">
            <div className="text-[15px] font-bold leading-tight tracking-tight">NeoSpark</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-2">Chat</div>
          </div>
        </div>
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={onNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-ink py-2.5 text-sm font-semibold text-surface shadow-[0_1px_2px_rgba(10,10,10,.16),0_10px_22px_-10px_rgba(10,10,10,.5)] transition-transform duration-200 hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" />
            New chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {/* Skills */}
          <div className="pt-2">
            <div className="px-1 pb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-2">Skills · multi-select</div>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((skill) => {
                const active = selectedSkills.includes(skill.id);
                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => onToggleSkill(skill.id)}
                    aria-pressed={active}
                    title={skill.description}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors',
                      active
                        ? 'border-ink bg-ink text-surface'
                        : 'border-line bg-paper text-muted hover:border-ink hover:text-ink',
                    )}
                  >
                    <span className="text-[13px] leading-none">{skill.emoji}</span>
                    {skill.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Model */}
          <div className="pt-5">
            <div className="px-1 pb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-2">Model</div>
            <div className="relative" ref={modelRef}>
              <button
                type="button"
                onClick={() => setModelOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-semibold text-ink-2 outline-none transition-colors hover:border-muted-2 focus:border-ink"
              >
                <span className="truncate">{modelLabel}</span>
                <ChevronDown className={cn('h-4 w-4 flex-none text-muted-2 transition-transform', modelOpen && 'rotate-180')} />
              </button>
              {modelOpen && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-panel">
                  <button
                    type="button"
                    onClick={() => {
                      onModelChange('');
                      setModelOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold transition-colors',
                      model === '' ? 'bg-line-soft text-ink' : 'text-ink-2 hover:bg-paper',
                    )}
                  >
                    Auto (skill default)
                    {model === '' && <Check className="h-3.5 w-3.5 flex-none text-orange-deep" />}
                  </button>
                  {models.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        onModelChange(m.id);
                        setModelOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold transition-colors',
                        model === m.id ? 'bg-line-soft text-ink' : 'text-ink-2 hover:bg-paper',
                      )}
                    >
                      {m.label}
                      {model === m.id && <Check className="h-3.5 w-3.5 flex-none text-orange-deep" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* History */}
          <div className="pt-5">
            <div className="px-1 pb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-2">History</div>
            {sessions.length === 0 ? (
              <p className="px-1 py-2 text-[13px] text-muted-2">No conversations yet.</p>
            ) : (
              groups
                .filter((g) => g.items.length > 0)
                .map((group) => {
                  const isCollapsed = collapsed.has(group.key);
                  return (
                    <div key={group.key}>
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.key)}
                        className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-muted-2 transition-colors hover:text-ink"
                      >
                        <span>
                          {group.label} · {group.items.length}
                        </span>
                        <ChevronDown className={cn('h-3.5 w-3.5 flex-none transition-transform', isCollapsed && '-rotate-90')} />
                      </button>
                      {!isCollapsed && (
                        <ul className="space-y-0.5 pb-1">
                          {group.items.map((s) => (
                            <li key={s.id}>
                              <div
                                className={cn(
                                  'group flex w-full items-center gap-0.5 rounded-xl px-1.5 py-1.5 transition-colors',
                                  s.id === activeId ? 'bg-line-soft' : 'hover:bg-paper',
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={() => onSelectSession(s.id)}
                                  className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 py-0.5 text-left"
                                >
                                  <MessageSquare className={cn('h-3.5 w-3.5 flex-none', s.id === activeId ? 'text-ink' : 'text-muted-2')} />
                                  <span className="min-w-0 flex-1">
                                    <span className={cn('block truncate text-[13px] font-medium', s.id === activeId ? 'text-ink' : 'text-ink-2')}>
                                      {s.title || 'New chat'}
                                    </span>
                                    <span className="block text-[11px] text-muted-2">{timeAgo(s.updatedAt)}</span>
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onPinSession(s.id, !s.pinned)}
                                  title={s.pinned ? 'Unpin' : 'Pin'}
                                  aria-label={s.pinned ? 'Unpin' : 'Pin'}
                                  className={cn(
                                    'flex-none rounded-md p-1.5 transition-all hover:bg-line-soft',
                                    s.pinned ? 'text-orange-deep opacity-100' : 'text-muted-2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-ink',
                                  )}
                                >
                                  <Pin className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPendingDelete({ id: s.id, title: s.title || 'New chat' })}
                                  title="Delete conversation"
                                  aria-label="Delete conversation"
                                  className="flex-none rounded-md p-1.5 text-muted-2 opacity-0 transition-all hover:bg-line-soft hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* User footer */}
        <div className="border-t border-line-soft px-3 py-3">
          {user ? (
            <div className="flex items-center gap-2.5">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" className="h-8 w-8 flex-none rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-orange/15 text-sm font-bold text-orange-deep">
                  {(user.name || user.email)[0]?.toUpperCase() ?? <User className="h-4 w-4" />}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold leading-tight">{user.name || user.email}</div>
                <div className="truncate text-[11px] text-muted-2">{user.email}</div>
              </div>
              <button
                type="button"
                onClick={() => void signOut()}
                title="Sign out"
                className="rounded-lg p-1.5 text-muted-2 transition-colors hover:bg-line-soft hover:text-ink"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openLogin}
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-ink py-2.5 text-sm font-semibold transition-colors hover:bg-ink hover:text-surface"
            >
              <User className="h-4 w-4" />
              {isLoading ? 'Loading…' : 'Sign in'}
            </button>
          )}
        </div>
      </aside>

      {/* Delete confirmation dialog */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Cancel" className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setPendingDelete(null)} />
          <div className="relative w-full max-w-xs rounded-2xl bg-surface p-6 shadow-panel" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <h3 id="delete-title" className="text-base font-bold tracking-tight">Delete this conversation?</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              「{pendingDelete.title}」 and all its messages will be permanently deleted and cannot be recovered.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="rounded-full px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-surface shadow-[0_1px_2px_rgba(10,10,10,.16),0_10px_22px_-10px_rgba(10,10,10,.5)] transition-transform duration-200 hover:-translate-y-0.5"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
