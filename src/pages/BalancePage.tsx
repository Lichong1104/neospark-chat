import { useEffect, useState } from 'react';
import { ArrowLeft, Coins, Snowflake } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { getBalance, getBillingHistory } from '../lib/api';
import type { BalanceInfo, PointTransaction } from '../types';

export default function BalancePage({ onBack }: { onBack: () => void }) {
  const { user, openLogin } = useAuth();
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);

  useEffect(() => {
    if (!user) return;
    getBalance().then(setBalance).catch(() => {});
    getBillingHistory(30).then(setTransactions).catch(() => {});
  }, [user]);

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
          <div className="truncate text-sm font-bold tracking-tight">Balance & usage</div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        {!user ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
            <p className="text-[15px] text-muted">Sign in to see your balance and subscription.</p>
            <button
              type="button"
              onClick={openLogin}
              className="mt-4 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-surface"
            >
              Sign in
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-[1.5rem] font-bold tracking-[-0.03em]">Credits</h1>
            <p className="mt-1 text-[14px] text-muted">
              Credits are spent on image, video and Skill runs. You can top up anytime from the pricing page.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
                <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-muted-2">
                  <Coins className="h-4 w-4" />
                  Available
                </div>
                <div className="mt-2 text-[1.9rem] font-bold tracking-[-0.03em]">
                  {balance ? balance.available_points.toLocaleString('en-US') : '—'}
                </div>
              </div>
              <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
                <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-muted-2">
                  <Snowflake className="h-4 w-4" />
                  Frozen
                </div>
                <div className="mt-2 text-[1.9rem] font-bold tracking-[-0.03em]">
                  {balance ? balance.frozen_points.toLocaleString('en-US') : '—'}
                </div>
              </div>
              <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
                <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-muted-2">
                  Total
                </div>
                <div className="mt-2 text-[1.9rem] font-bold tracking-[-0.03em]">
                  {balance ? balance.total_points.toLocaleString('en-US') : '—'}
                </div>
              </div>
            </div>

            {balance?.points_expires_at && (
              <p className="mt-4 text-[13px] text-muted-2">
                {balance.points_expired ? 'Credits expired on' : 'Credits expire on'}{' '}
                {new Date(balance.points_expires_at).toLocaleDateString('en-US')}
              </p>
            )}

            <h2 className="mt-10 text-[1.25rem] font-bold tracking-[-0.02em]">Usage history</h2>
            {transactions.length === 0 ? (
              <p className="mt-3 text-[14px] text-muted">No usage yet.</p>
            ) : (
              <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
                <ul className="divide-y divide-line-soft">
                  {transactions.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold">{t.type_name}</div>
                        <div className="truncate text-[12px] text-muted-2">
                          {t.description || t.biz_type || ''}
                          {t.created_at ? ` · ${new Date(t.created_at).toLocaleString('en-US')}` : ''}
                        </div>
                      </div>
                      <div className={`flex-none text-[13px] font-bold ${t.points >= 0 ? 'text-[#03704d]' : 'text-ink'}`}>
                        {t.points >= 0 ? '+' : ''}{t.points.toLocaleString('en-US')}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
