import { useEffect, useState } from 'react';
import { ArrowLeft, CreditCard, TriangleAlert } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { cancelSubscription, getBillingState } from '../lib/api';
import type { BillingState } from '../types';

export default function SubscriptionPage({ onBack }: { onBack: () => void }) {
  const { user, openLogin } = useAuth();
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [busy, setBusy] = useState<'immediate' | 'period' | null>(null);
  const [confirmMode, setConfirmMode] = useState<'immediate' | 'period' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getBillingState().then(setBilling).catch(() => {});
  }, [user]);

  const sub = billing?.subscription;

  const refresh = async () => {
    try {
      setBilling(await getBillingState());
    } catch {
      // keep the current state on a transient refresh error
    }
  };

  const doCancel = async (immediately: boolean) => {
    setBusy(immediately ? 'immediate' : 'period');
    setError(null);
    try {
      await cancelSubscription(immediately);
      setConfirmMode(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message || 'Failed to cancel subscription');
    } finally {
      setBusy(null);
    }
  };

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
          <div className="truncate text-sm font-bold tracking-tight">Subscription</div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        {!user ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
            <p className="text-[15px] text-muted">Sign in to manage your subscription.</p>
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
            <h1 className="text-[1.5rem] font-bold tracking-[-0.03em]">Subscription</h1>

            {sub ? (
              <div className="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-card">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-6 w-6 text-orange-deep" />
                  <div>
                    <div className="text-lg font-bold capitalize">
                      {sub.planKey} · {sub.billingInterval}
                    </div>
                    <div className="text-[13px] text-muted-2">
                      Status: <span className="font-semibold capitalize">{sub.status}</span>
                    </div>
                  </div>
                </div>

                <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <dt className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted-2">Billing interval</dt>
                    <dd className="mt-1 font-medium capitalize">{sub.billingInterval}</dd>
                  </div>
                  <div>
                    <dt className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted-2">Current period ends</dt>
                    <dd className="mt-1 font-medium">
                      {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString('en-US') : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted-2">Renewal</dt>
                    <dd className="mt-1 font-medium">
                      {sub.cancelAtPeriodEnd ? 'Cancels at period end' : 'Renews automatically'}
                    </dd>
                  </div>
                </dl>

                {error && (
                  <p className="mt-4 rounded-lg bg-orange/10 px-3 py-2 text-[13px] font-medium text-orange-deep">{error}</p>
                )}

                <div className="mt-6 flex flex-wrap gap-2 border-t border-line-soft pt-5">
                  <button
                    type="button"
                    onClick={() => setConfirmMode('period')}
                    disabled={sub.cancelAtPeriodEnd || busy !== null}
                    className="rounded-full border border-ink px-4 py-2 text-sm font-semibold transition-colors hover:bg-ink hover:text-surface disabled:opacity-40"
                  >
                    Cancel at period end
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmMode('immediate')}
                    disabled={busy !== null}
                    className="rounded-full border border-orange-deep px-4 py-2 text-sm font-semibold text-orange-deep transition-colors hover:bg-orange-deep hover:text-surface disabled:opacity-40"
                  >
                    Cancel immediately
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-line bg-surface p-6 text-center shadow-card">
                <p className="text-[14px] text-muted">You don't have an active subscription.</p>
                <button
                  type="button"
                  onClick={onBack}
                  className="mt-4 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-surface"
                >
                  See plans
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Cancel confirmation dialog */}
      {confirmMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Cancel" className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setConfirmMode(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-surface p-6 shadow-panel" role="dialog" aria-modal="true">
            <div className="flex items-center gap-2 text-orange-deep">
              <TriangleAlert className="h-5 w-5" />
              <h3 className="text-base font-bold tracking-tight">
                {confirmMode === 'immediate' ? 'Cancel immediately?' : 'Cancel at period end?'}
              </h3>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {confirmMode === 'immediate'
                ? 'Your subscription ends now and you may receive a prorated refund for the unused period.'
                : 'Your subscription stays active until the current period ends, then cancels without renewing.'}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmMode(null)}
                className="rounded-full px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-ink"
              >
                Keep plan
              </button>
              <button
                type="button"
                onClick={() => void doCancel(confirmMode === 'immediate')}
                disabled={busy !== null}
                className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-surface disabled:opacity-40"
              >
                {busy !== null ? 'Cancelling…' : 'Confirm cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
