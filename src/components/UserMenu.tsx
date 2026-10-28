import { useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { ChevronDown, ChevronUp, KeyRound, LogOut, User as UserIcon, Wrench } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import type { View } from '../types';
import { cn } from '../lib/utils';

interface UserMenuProps {
  collapsed: boolean;
  onNavigate: (view: View) => void;
}

function MenuItem({
  icon: Icon,
  label,
  hint,
  danger,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-paper',
        danger ? 'text-orange-dark' : 'text-ink-2',
      )}
    >
      <Icon className="h-4 w-4 flex-none" />
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{label}</span>
      {hint && <span className="flex-none text-[11px] text-muted-2">{hint}</span>}
    </button>
  );
}

/**
 * Bottom-left account trigger. One click opens the platform menu — User, Skill,
 * API Key and Sign out — and each entry opens its own page in the app.
 */
export default function UserMenu({ collapsed, onNavigate }: UserMenuProps) {
  const { user, isLoading, openLogin, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const go = (view: View) => {
    close();
    onNavigate(view);
  };

  return (
    <div ref={wrapperRef} className="relative">
      {user ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
          title={collapsed ? user.name || user.email : undefined}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-left transition-colors hover:bg-line-soft',
            collapsed && 'justify-center px-0',
            open && 'bg-line-soft',
          )}
        >
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" className="h-8 w-8 flex-none rounded-full object-cover" />
          ) : (
            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-orange/15 text-sm font-bold text-orange-deep">
              {(user.name || user.email)[0]?.toUpperCase() ?? <UserIcon className="h-4 w-4" />}
            </div>
          )}
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold leading-tight">{user.name || user.email}</div>
                <div className="truncate text-[11px] text-muted-2">{user.email}</div>
              </div>
              {open ? (
                <ChevronDown className="h-4 w-4 flex-none text-muted-2" />
              ) : (
                <ChevronUp className="h-4 w-4 flex-none text-muted-2" />
              )}
            </>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={openLogin}
          disabled={isLoading}
          title={collapsed ? 'Sign in' : undefined}
          className={cn('flex w-full items-center justify-center gap-2 rounded-full border border-ink py-2.5 text-sm font-semibold transition-colors hover:bg-ink hover:text-surface', collapsed && 'px-0')}
        >
          <UserIcon className="h-4 w-4" />
          {!collapsed && (isLoading ? 'Loading…' : 'Sign in')}
        </button>
      )}

      {open && user && (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-50 mb-2 w-60 max-w-[calc(100vw-1rem)] rounded-2xl border border-line bg-surface p-1.5 shadow-panel"
        >
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" className="h-8 w-8 flex-none rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-orange/15 text-sm font-bold text-orange-deep">
                {(user.name || user.email)[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-bold leading-tight">{user.name || 'NeoSpark user'}</div>
              <div className="truncate text-[11px] text-muted-2">{user.email}</div>
            </div>
          </div>

          <div className="my-1 h-px bg-line-soft" />

          <MenuItem icon={UserIcon} label="User" hint="Account" onClick={() => go('user')} />
          <MenuItem icon={Wrench} label="Skill" hint="Market" onClick={() => go('skills')} />
          <MenuItem icon={KeyRound} label="API Key" onClick={() => go('api-keys')} />

          <div className="my-1 h-px bg-line-soft" />

          <MenuItem
            icon={LogOut}
            label="Sign out"
            danger
            onClick={() => {
              close();
              void signOut();
            }}
          />
        </div>
      )}
    </div>
  );
}
