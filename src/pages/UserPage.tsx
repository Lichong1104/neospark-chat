import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, Coins, CreditCard, ExternalLink, KeyRound, LogOut, Shield, Snowflake, Tag, User as UserIcon } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { getBalance, getBillingState } from '../lib/api';
import type { BalanceInfo, BillingState, View } from '../types';

const PLATFORM_BASE = 'https://platform.useneospark.com';

export default function UserPage({
  onBack,
  onNavigate,
}: {
  onBack: () => void;
  onNavigate: (view: View) => void;
}) {
  const { user, openLogin, signOut } = useAuth();
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [billing, setBilling] = useState<BillingState | null>(null);

  useEffect(() => {
    if (!user) return;
    getBalance().then(setBalance).catch(() => {});
    getBillingState().then(setBilling).catch(() => {});
  }, [user]);

  const planLabel = billing?.subscription?.planKey;

  const linkRow = (label: string, hint: string, icon: ReactNode, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-line-soft px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-paper"
    >
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-line-soft text-ink">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold">{label}</span>
        <span className="block text-[11px] text-muted-2">{hint}</span>
      </span>
      <span className="text-muted-2">›</span>
    </button>
  );

  return (
    <main className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto">
      <header className="flex items-center gap-3 border-b border-line bg-surface/70 px-6 py-3 backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to chat
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold tracking-tight">User</div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        {!user ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
            <p className="text-[15px] text-muted">Sign in to see your account.</p>
            <button type="button" onClick={openLogin} className="mt-4 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-surface">
              Sign in
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-[1.5rem] font-bold tracking-[-0.03em]">Account</h1>
            <p className="mt-1 text-[14px] text-muted">Your profile, plan and credit balance.</p>

            {/* Profile */}
            <div className="mt-6 flex items-center gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" className="h-14 w-14 flex-none rounded-full object-cover" />
              ) : (
                <div className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-orange/15 text-xl font-bold text-orange-deep">
                  {(user.name || user.email)[0]?.toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[16px] font-bold tracking-tight">{user.name || 'NeoSpark user'}</div>
                <div className="truncate text-[13px] text-muted-2">{user.email}</div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-2">
                  <span className="rounded-full bg-line-soft px-2 py-0.5 font-bold uppercase tracking-wide">
                    {planLabel ? planLabel : 'Free'}
                  </span>
                  <span>User #{user.id}</span>
                </div>
              </div>
            </div>

            {/* Credits */}
            <h2 className="mt-8 text-[1.1rem] font-bold tracking-[-0.02em]">Credits</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-2">
                  <Coins className="h-4 w-4" />
                  Available
                </div>
                <div className="mt-1.5 text-[1.6rem] font-bold tracking-[-0.03em]">
                  {balance ? balance.available_points.toLocaleString('en-US') : user.balance.toLocaleString('en-US')}
                </div>
              </div>
              <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-2">
                  <Snowflake className="h-4 w-4" />
                  Frozen
                </div>
                <div className="mt-1.5 text-[1.6rem] font-bold tracking-[-0.03em]">
                  {balance ? balance.frozen_points.toLocaleString('en-US') : '—'}
                </div>
              </div>
              <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-2">
                  <Tag className="h-4 w-4" />
                  Total
                </div>
                <div className="mt-1.5 text-[1.6rem] font-bold tracking-[-0.03em]">
                  {balance ? balance.total_points.toLocaleString('en-US') : '—'}
                </div>
              </div>
            </div>

            {/* Shortcuts */}
            <h2 className="mt-8 text-[1.1rem] font-bold tracking-[-0.02em]">Shortcuts</h2>
            <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
              {linkRow('Balance & usage', 'Credit ledger and spend history', <Coins className="h-4 w-4" />, () => onNavigate('balance'))}
              {linkRow('Subscription', 'Plan, renewals and billing portal', <CreditCard className="h-4 w-4" />, () => onNavigate('subscription'))}
              {linkRow('Pricing & plans', 'Top up credits or change plan', <Tag className="h-4 w-4" />, () => onNavigate('pricing'))}
              {linkRow('API keys', 'Keys for scripts and agents', <KeyRound className="h-4 w-4" />, () => onNavigate('api-keys'))}
              {linkRow('Account center', 'Profile and security on the platform site', <ExternalLink className="h-4 w-4" />, () => window.open(`${PLATFORM_BASE}/account`, '_blank', 'noopener'))}
              {user.is_admin &&
                linkRow('Admin console', 'Skill review, users and system settings', <Shield className="h-4 w-4" />, () =>
                  window.open(`${PLATFORM_BASE}/admin`, '_blank', 'noopener'),
                )}
            </div>

            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-6 flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-orange-dark transition-colors hover:border-orange/50 hover:bg-orange/5"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>

            <p className="mt-6 flex items-center gap-1.5 text-[11px] text-muted-2">
              <UserIcon className="h-3.5 w-3.5" />
              Signed in with {user.email}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
