import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Coins, CreditCard, Loader2, LogOut, MessageSquare, PanelLeftClose, PanelLeftOpen, Pin, Plus, Tag, Trash2, User } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import type { BalanceInfo, BillingState, Session } from '../types';
import { cn } from '../lib/utils';
import { getBalance, getBillingState } from '../lib/api';

interface SidebarProps {
  sessions: Session[];
  activeId: string | null;
  loadingSessions: boolean;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onPinSession: (id: string, pinned: boolean) => void;
  onNewChat: () => void;
  view: 'chat' | 'pricing' | 'balance' | 'subscription';
  onNavigate: (view: 'chat' | 'pricing' | 'balance' | 'subscription') => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
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
  sessions,
  activeId,
  loadingSessions,
  onSelectSession,
  onDeleteSession,
  onPinSession,
  onNewChat,
  view,
  onNavigate,
  collapsed,
  onToggleCollapsed,
}: SidebarProps) {
  const { user, isLoading, openLogin, signOut } = useAuth();
  const [groupCollapsed, setGroupCollapsed] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [balance, setBalance] = useState<BalanceInfo | null>(null);

  useEffect(() => {
    if (!user) {
      setBilling(null);
      setBalance(null);
      return;
    }
    getBillingState().then(setBilling).catch(() => {});
    getBalance().then(setBalance).catch(() => {});
  }, [user]);

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
    setGroupCollapsed((prev) => {
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

  const navItems = [
    { key: 'pricing', label: 'Pricing', icon: Tag },
    { key: 'balance', label: 'Balance & usage', icon: Coins },
    { key: 'subscription', label: 'Subscription', icon: CreditCard },
  ] as const;

  const planLabel = billing?.subscription?.planKey;

  return (
    <>
      <aside className={cn('flex h-full flex-none flex-col border-r border-line bg-surface transition-[width] duration-200', collapsed ? 'w-[60px]' : 'w-72')}>
        {/* Brand + collapse */}
        <div className={cn('flex items-center gap-2.5 px-4 pb-3 pt-5', collapsed && 'flex-col px-0')}>
          <BrandMark />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-bold leading-tight tracking-tight">NeoSpark</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-2">Chat</div>
            </div>
          )}
          <button
            type="button"
            onClick={onToggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn('rounded-lg p-1.5 text-muted-2 transition-colors hover:bg-line-soft hover:text-ink', collapsed && 'mt-1')}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        {/* New chat */}
        <div className={cn('px-3 pb-3', collapsed && 'px-2')}>
          <button
            type="button"
            onClick={onNewChat}
            title={collapsed ? 'New chat' : undefined}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-full bg-ink py-2.5 text-sm font-semibold text-surface shadow-[0_1px_2px_rgba(10,10,10,.16),0_10px_22px_-10px_rgba(10,10,10,.5)] transition-transform duration-200 hover:-translate-y-0.5',
              collapsed && 'px-0',
            )}
          >
            <Plus className="h-4 w-4" />
            {!collapsed && 'New chat'}
          </button>
        </div>

        {/* Nav: pricing / balance */}
        <div className={cn('space-y-0.5 px-3 pb-3', collapsed && 'px-2')}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigate(item.key)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-semibold transition-colors',
                  active ? 'bg-line-soft text-ink' : 'text-ink-2 hover:bg-paper',
                  collapsed && 'justify-center px-0',
                )}
              >
                <Icon className="h-4 w-4 flex-none" />
                {!collapsed && item.label}
              </button>
            );
          })}
        </div>

        {/* Collapsed history: an icon that reveals the list on hover */}
        {collapsed && (
          <div className="group relative px-2 pb-3">
            <button
              type="button"
              title="History"
              className="flex w-full items-center justify-center rounded-xl py-2 text-muted-2 transition-colors hover:bg-paper hover:text-ink"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
            <div className="invisible absolute left-full top-0 z-40 ml-1 max-h-[70vh] w-64 overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-panel opacity-0 transition-opacity group-hover:visible group-hover:opacity-100">
              <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-2">History</p>
              {sessions.length === 0 ? (
                <p className="px-2 py-2 text-[13px] text-muted-2">No conversations yet.</p>
              ) : (
                sessions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onNavigate('chat');
                      onSelectSession(s.id);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                      s.id === activeId ? 'bg-line-soft' : 'hover:bg-paper',
                    )}
                  >
                    <MessageSquare className="h-3.5 w-3.5 flex-none text-muted-2" />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-2">
                      {s.title || 'New chat'}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* History */}
        {!collapsed && (
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            <div className="pt-2">
              <div className="px-1 pb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-2">History</div>
              {loadingSessions ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-2" />
                </div>
              ) : sessions.length === 0 ? (
                <p className="px-1 py-2 text-[13px] text-muted-2">No conversations yet.</p>
              ) : (
                groups
                  .filter((g) => g.items.length > 0)
                  .map((group) => {
                    const isCollapsed = groupCollapsed.has(group.key);
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
                                    onClick={() => {
                                      onNavigate('chat');
                                      onSelectSession(s.id);
                                    }}
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
        )}

        {/* User footer */}
        <div className={cn('mt-auto border-t border-line-soft px-3 py-3', collapsed && 'px-2')}>
          {user ? (
            <div className={cn('flex items-center gap-2.5', collapsed && 'flex-col items-center justify-center')}>
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" className="h-8 w-8 flex-none rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-orange/15 text-sm font-bold text-orange-deep">
                  {(user.name || user.email)[0]?.toUpperCase() ?? <User className="h-4 w-4" />}
                </div>
              )}
              {!collapsed && (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold leading-tight">{user.name || user.email}</div>
                    <div className="truncate text-[11px] text-muted-2">
                      {planLabel ? (
                        <span className="capitalize">{planLabel}</span>
                      ) : (
                        'Free'
                      )}
                      {' · '}
                      {balance ? `${balance.available_points.toLocaleString('en-US')} credits` : `${user.balance} credits`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    title="Sign out"
                    className="rounded-lg p-1.5 text-muted-2 transition-colors hover:bg-line-soft hover:text-ink"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={openLogin}
              disabled={isLoading}
              title={collapsed ? 'Sign in' : undefined}
              className={cn('flex w-full items-center justify-center gap-2 rounded-full border border-ink py-2.5 text-sm font-semibold transition-colors hover:bg-ink hover:text-surface', collapsed && 'px-0')}
            >
              <User className="h-4 w-4" />
              {!collapsed && (isLoading ? 'Loading…' : 'Sign in')}
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
