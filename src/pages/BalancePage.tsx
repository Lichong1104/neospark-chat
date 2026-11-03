import { useEffect, useState } from 'react';
import { Coins, Snowflake } from 'lucide-react';
import PageShell from '../components/PageShell';
import { useAuth } from '../auth/AuthContext';
import { getBalance, getBillingHistory } from '../lib/api';
import type { BalanceInfo, PointTransaction } from '../types';

export default function BalancePage({ onBack, onOpenNav }: { onBack: () => void; onOpenNav: () => void }) {
  const { user, openLogin } = useAuth();
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);

  useEffect(() => {
    if (!user) return;
    getBalance().then(setBalance).catch(() => {});
    getBillingHistory(30).then(setTransactions).catch(() => {});
  }, [user]);

  return (
    <PageShell title="Balance & usage" onBack={onBack} onOpenNav={onOpenNav}>
        {!user ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
            <p className="text-base text-muted">Sign in to see your balance and subscription.</p>
            <button
              type="button"
              onClick={openLogin}
              className="mt-4 min-h-10 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-surface"
            >
              Sign in
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-[-0.03em]">Credits</h1>
            <p className="mt-1 text-sm text-muted">
              Credits are spent on image, video and Skill runs. You can top up anytime from the pricing page.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-2">
                  <Coins className="h-4 w-4" />
                  Available
                </div>
                <div className="mt-2 text-3xl font-bold tracking-[-0.03em]">
                  {balance ? balance.available_points.toLocaleString('en-US') : '—'}
                </div>
              </div>
              <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-2">
                  <Snowflake className="h-4 w-4" />
                  Frozen
                </div>
                <div className="mt-2 text-3xl font-bold tracking-[-0.03em]">
                  {balance ? balance.frozen_points.toLocaleString('en-US') : '—'}
                </div>
              </div>
              <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-2">
                  Total
                </div>
                <div className="mt-2 text-3xl font-bold tracking-[-0.03em]">
                  {balance ? balance.total_points.toLocaleString('en-US') : '—'}
                </div>
              </div>
            </div>

            {balance?.points_expires_at && (
              <p className="mt-4 text-sm text-muted-2">
                {balance.points_expired ? 'Credits expired on' : 'Credits expire on'}{' '}
                {new Date(balance.points_expires_at).toLocaleDateString('en-US')}
              </p>
            )}

            <h2 className="mt-10 text-xl font-bold tracking-[-0.02em]">Usage history</h2>
            {transactions.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No usage yet.</p>
            ) : (
              <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
                <ul className="divide-y divide-line-soft">
                  {transactions.map((t) => {
                    const isDebit = t.type === 'consume' || t.type === 'reserve' || t.type === 'expire';
                    const isCredit = t.type === 'grant' || t.type === 'release';
                    const sign = isDebit ? '-' : isCredit ? '+' : t.points >= 0 ? '+' : '';
                    return (
                      <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">{t.type_name}</div>
                          <div className="truncate text-xs text-muted-2">
                            {t.description || t.biz_type || ''}
                            {t.created_at ? ` · ${new Date(t.created_at).toLocaleString('en-US')}` : ''}
                          </div>
                        </div>
                        <div className={`flex-none text-sm font-bold ${isCredit ? 'text-success' : 'text-ink'}`}>
                          {sign}{Math.abs(t.points).toLocaleString('en-US')}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
    </PageShell>
  );
}
