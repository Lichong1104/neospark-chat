import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Check, Coins, Loader2, LogOut, Pencil, Snowflake, Tag, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../auth/AuthContext';
import { getBalance, getBillingState, updateProfile, uploadAvatar } from '../lib/api';
import type { BalanceInfo, BillingState } from '../types';

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function planStatus(billing: BillingState | null): string {
  const sub = billing?.subscription;
  if (!sub) return 'No subscription';
  if (sub.cancelAtPeriodEnd) return `Cancels on ${fmtDate(sub.currentPeriodEnd)}`;
  return sub.status ? `${sub.status[0].toUpperCase()}${sub.status.slice(1)}` : 'Active';
}

export default function UserPage({ onBack }: { onBack: () => void }) {
  const { user, openLogin, signOut, refresh } = useAuth();
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [billing, setBilling] = useState<BillingState | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    getBalance().then(setBalance).catch(() => {});
    getBillingState().then(setBilling).catch(() => {});
  }, [user]);

  const planLabel = billing?.subscription?.planKey ?? 'Free';

  const startEditName = () => {
    setNameDraft(user?.name ?? '');
    setEditingName(true);
  };

  const saveName = async () => {
    const next = nameDraft.trim();
    if (!next) {
      toast.error('Name cannot be empty');
      return;
    }
    setSavingName(true);
    try {
      await updateProfile({ name: next });
      await refresh();
      toast.success('Name updated');
      setEditingName(false);
    } catch {
      toast.error('Could not update your name');
    } finally {
      setSavingName(false);
    }
  };

  const changeAvatar = async (file: File | undefined) => {
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadAvatar(file);
      if (!url) throw new Error('no url');
      await updateProfile({ avatar_url: url });
      await refresh();
      toast.success('Avatar updated');
    } catch {
      toast.error('Could not update your avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const detail = (label: string, value: string) => (
    <div className="flex items-center justify-between gap-4 border-b border-line-soft px-4 py-3 last:border-b-0">
      <span className="flex-none text-[12px] font-bold uppercase tracking-[0.1em] text-muted-2">{label}</span>
      <span className="min-w-0 truncate text-right text-[13px] font-semibold">{value}</span>
    </div>
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
              <div className="relative flex-none">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange/15 text-xl font-bold text-orange-deep">
                    {(user.name || user.email)[0]?.toUpperCase()}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  title="Change avatar"
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-card transition-colors hover:bg-paper disabled:opacity-60"
                >
                  {uploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    void changeAvatar(file);
                  }}
                />
              </div>

              <div className="min-w-0 flex-1">
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={nameDraft}
                      onChange={(event) => setNameDraft(event.target.value)}
                      autoFocus
                      maxLength={255}
                      className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[14px] font-bold outline-none focus:border-ink"
                    />
                    <button
                      type="button"
                      onClick={() => void saveName()}
                      disabled={savingName}
                      className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-ink text-surface disabled:opacity-60"
                      title="Save"
                    >
                      {savingName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingName(false)}
                      className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-line text-muted-2 hover:text-ink"
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 truncate text-[16px] font-bold tracking-tight">{user.name || 'NeoSpark user'}</span>
                    <button
                      type="button"
                      onClick={startEditName}
                      title="Edit name"
                      className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-muted-2 transition-colors hover:bg-paper hover:text-ink"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <div className="truncate text-[13px] text-muted-2">{user.email}</div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-2">
                  <span className="rounded-full bg-line-soft px-2 py-0.5 font-bold uppercase tracking-wide">{planLabel}</span>
                  <span>User #{user.id}</span>
                </div>
              </div>
            </div>

            {/* Account details */}
            <h2 className="mt-8 text-[1.1rem] font-bold tracking-[-0.02em]">Account details</h2>
            <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
              {detail('Email', user.email)}
              {detail('Registered', fmtDate(user.created_at))}
              {detail('Plan', planLabel)}
              {detail('Subscription', planStatus(billing))}
              {detail('User ID', `#${user.id}`)}
              {detail('Role', user.is_admin ? 'Administrator' : 'Member')}
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
            {balance?.points_expires_at && (
              <p className="mt-3 text-[12px] text-muted-2">
                {balance.points_expired ? 'Credits expired on' : 'Credits expire on'} {fmtDate(balance.points_expires_at)}
              </p>
            )}

            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-8 flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-orange-dark transition-colors hover:border-orange/50 hover:bg-orange/5"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </>
        )}
      </div>
    </main>
  );
}
