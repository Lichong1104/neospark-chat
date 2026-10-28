import { useEffect, useState } from 'react';
import { ArrowLeft, Check, CreditCard, ExternalLink, Sparkles, TriangleAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { cancelSubscription, getBillingPortal, getBillingState } from '../lib/api';
import type { BillingState } from '../types';

interface PlanDetail {
  name: string;
  blurb: string;
  monthly: number;
  yearly: number;
  features: string[];
}

const PLAN_DETAILS: Record<string, PlanDetail> = {
  free: {
    name: 'Free',
    blurb: 'You are on the free plan. Upgrade for more credits, a faster queue and a commercial license.',
    monthly: 0,
    yearly: 0,
    features: [
      '200 credits a month',
      'Basic AI models',
      'Standard queue',
      'Personal use only',
      '1× speed',
    ],
  },
  starter: {
    name: 'Starter',
    blurb: 'Perfect for beginners.',
    monthly: 18,
    yearly: 168,
    features: ['2,000 credits a month', 'All Skills', 'Standard image quality', '1× speed'],
  },
  growth: {
    name: 'Growth',
    blurb: 'Best value for creators.',
    monthly: 31,
    yearly: 300,
    features: [
      '3,500 credits a month',
      'Higher-resolution renders',
      'Priority queue',
      '1.5× speed',
    ],
  },
  pro: {
    name: 'Pro',
    blurb: 'For professional creators.',
    monthly: 68,
    yearly: 528,
    features: ['11,000 credits a month', '4K renders', 'Video Skills', '2× speed', 'Commercial license'],
  },
  ultimate: {
    name: 'Ultimate',
    blurb: 'For teams & studios.',
    monthly: 148,
    yearly: 1176,
    features: [
      '27,000 credits a month',
      'Fastest queue',
      'Early access to new Skills',
      '3× speed',
      'Commercial license',
    ],
  },
};

export default function SubscriptionPage({ onBack }: { onBack: () => void }) {
  const { user, openLogin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [billingLoaded, setBillingLoaded] = useState(false);
  const [busy, setBusy] = useState<'immediate' | 'period' | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [confirmMode, setConfirmMode] = useState<'immediate' | 'period' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Subscription — NeoSpark';
    return () => {
      document.title = previous;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setBilling(null);
      setBillingLoaded(false);
      return;
    }

    let cancelled = false;
    setBillingLoaded(false);
    getBillingState()
      .then((state) => {
        if (!cancelled) setBilling(state);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your subscription. Please refresh the page.');
      })
      .finally(() => {
        if (!cancelled) setBillingLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const sub = billing?.subscription;
  const planKey = (sub?.planKey ?? 'free').toLowerCase();
  const plan = PLAN_DETAILS[planKey] ?? PLAN_DETAILS.free;
  const yearly = sub?.billingInterval === 'yearly';
  const price = sub ? (yearly ? plan.yearly : plan.monthly) : 0;
  const intervalLabel = yearly ? 'year' : 'month';
  const periodEnd = sub?.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const statusLabel = !sub
    ? 'Free plan'
    : sub.cancelAtPeriodEnd
      ? 'Cancels at period end'
      : sub.status;
  const statusTone = !sub
    ? 'bg-line-soft text-muted'
    : sub.cancelAtPeriodEnd
      ? 'bg-orange/10 text-orange-deep'
      : sub.status === 'active' || sub.status === 'trialing'
        ? 'bg-[#e2faf1] text-[#03704d]'
        : 'bg-line-soft text-muted';

  const doCancel = async (immediately: boolean) => {
    setBusy(immediately ? 'immediate' : 'period');
    setError(null);
    try {
      await cancelSubscription(immediately);
      setConfirmMode(null);
      setBilling(await getBillingState());
    } catch (e) {
      setError((e as Error).message || 'Failed to cancel subscription');
    } finally {
      setBusy(null);
    }
  };

  const manageBilling = async () => {
    setPortalBusy(true);
    setError(null);
    try {
      const url = await getBillingPortal();
      window.location.href = url;
    } catch (e) {
      setError((e as Error).message || 'Could not open the billing portal.');
    } finally {
      setPortalBusy(false);
    }
  };

  const skeleton = (
    <div className="animate-pulse rounded-2xl border border-line bg-surface p-7 shadow-card sm:p-8">
      <div className="h-3 w-24 rounded bg-line" />
      <div className="mt-4 h-8 w-40 rounded bg-line" />
      <div className="mt-3 h-3 w-full max-w-md rounded bg-line-soft" />
      <div className="mt-8 grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-3 w-32 rounded bg-line-soft" />
        ))}
      </div>
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
          <div className="truncate text-sm font-bold tracking-tight">Subscription</div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        {authLoading || (user && !billingLoaded) ? (
          skeleton
        ) : !user ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
            <CreditCard className="mx-auto h-6 w-6 text-orange-deep" />
            <p className="mt-3 text-[15px] text-muted">Sign in to manage your subscription.</p>
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
            <section className="rounded-2xl border border-line bg-surface p-7 shadow-card sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-2">Current plan</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2.5">
                    <CreditCard className="h-5 w-5 text-orange-deep" />
                    <h1 className="text-[1.75rem] font-bold tracking-[-0.03em]">{plan.name}</h1>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${statusTone}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <p className="mt-2 max-w-md text-[14px] leading-relaxed text-muted">{plan.blurb}</p>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-[2rem] font-bold leading-none tracking-[-0.03em]">
                    {price === 0 ? 'Free' : `$${price.toLocaleString('en-US')}`}
                  </div>
                  <div className="mt-1 text-[12px] text-muted-2">
                    {price === 0 ? 'no card required' : `per ${intervalLabel}`}
                  </div>
                </div>
              </div>

              <ul className="mt-7 grid grid-cols-1 gap-2.5 border-t border-line-soft pt-6 sm:grid-cols-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-[14px] text-ink-2">
                    <Check className="h-4 w-4 flex-none text-orange-deep" />
                    {feature}
                  </li>
                ))}
              </ul>
            </section>

            {error && (
              <p className="mt-4 rounded-xl bg-orange/10 px-4 py-3 text-[13px] font-medium text-orange-deep">
                {error}
              </p>
            )}

            {sub ? (
              <section className="mt-4 rounded-2xl border border-line bg-surface p-7 shadow-card sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-[15px] font-bold tracking-tight">Billing details</h2>
                  <button
                    type="button"
                    onClick={() => void manageBilling()}
                    disabled={portalBusy}
                    className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-[12px] font-semibold text-muted transition-colors hover:border-ink hover:text-ink disabled:opacity-40"
                  >
                    {portalBusy ? 'Opening…' : 'Manage billing'}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-2">Billing interval</dt>
                    <dd className="mt-1 font-medium capitalize">{sub.billingInterval}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-2">Current period ends</dt>
                    <dd className="mt-1 font-medium">{periodEnd ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-2">Status</dt>
                    <dd className="mt-1 font-medium capitalize">{sub.status}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-2">Renewal</dt>
                    <dd className="mt-1 font-medium">
                      {sub.cancelAtPeriodEnd ? 'Cancels at period end' : 'Renews automatically'}
                    </dd>
                  </div>
                </dl>

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
                <p className="mt-3 text-[12px] leading-relaxed text-muted-2">
                  Cancelling at period end keeps access until {periodEnd ?? 'your current period ends'}.
                  Immediate cancellation ends access now and may be prorated.
                </p>
              </section>
            ) : (
              <section className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-7 shadow-card sm:p-8">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 flex-none text-orange-deep" />
                  <div>
                    <h2 className="text-[15px] font-bold tracking-tight">Want more credits?</h2>
                    <p className="mt-1 max-w-md text-[14px] leading-relaxed text-muted">
                      Compare Starter, Growth, Pro and Ultimate. Every paid plan opens the full
                      Skill catalogue and adds a faster queue.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/pricing')}
                  className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-surface shadow-[0_1px_2px_rgba(10,10,10,.16),0_10px_22px_-10px_rgba(10,10,10,.5)] transition-transform duration-200 hover:-translate-y-0.5"
                >
                  Compare plans
                </button>
              </section>
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
