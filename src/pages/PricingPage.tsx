import { useEffect, useState } from 'react';
import { ArrowLeft, Check, CreditCard } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { createCheckout, getBillingPortal, getBillingState } from '../lib/api';
import type { BillingState } from '../types';
import { cn } from '../lib/utils';

interface Plan {
  key: string;
  name: string;
  monthly: number;
  yearly: number;
  blurb: string;
  features: string[];
}

const PLANS: Plan[] = [
  {
    key: 'starter',
    name: 'Starter',
    monthly: 18,
    yearly: 168,
    blurb: 'Perfect for beginners · 2,000 credits/month',
    features: ['2,000 credits every month', 'All Skills in the catalogue', 'Standard image quality'],
  },
  {
    key: 'growth',
    name: 'Growth',
    monthly: 31,
    yearly: 300,
    blurb: 'Best value for creators · 3,500 credits/month',
    features: ['3,500 credits every month', 'Higher resolution renders', 'Priority queue'],
  },
  {
    key: 'pro',
    name: 'Pro',
    monthly: 68,
    yearly: 528,
    blurb: 'For professional creators · 11,000 credits/month',
    features: ['11,000 credits every month', '4K renders', 'Video Skills included'],
  },
  {
    key: 'ultimate',
    name: 'Ultimate',
    monthly: 148,
    yearly: 1176,
    blurb: 'For teams & studios · 27,000 credits/month',
    features: ['27,000 credits every month', 'Fastest queue', 'Early access to new Skills'],
  },
];

export default function PricingPage({ onBack }: { onBack: () => void }) {
  const { user, openLogin } = useAuth();
  const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getBillingState().then(setBilling).catch(() => {});
  }, []);

  const subscribe = async (plan: string) => {
    if (!user) {
      openLogin();
      return;
    }
    setBusy(plan);
    try {
      const url = await createCheckout(plan, interval);
      window.location.href = url;
    } catch (e) {
      // keep the user on the page and let them retry
      setBusy(null);
      throw e;
    } finally {
      if (busy === plan) setBusy(null);
    }
  };

  const manage = async () => {
    setBusy('portal');
    try {
      const url = await getBillingPortal();
      window.location.href = url;
    } finally {
      setBusy(null);
    }
  };

  const sub = billing?.subscription;

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
          <div className="truncate text-sm font-bold tracking-tight">Pricing</div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="text-center">
          <h1 className="text-[1.75rem] font-bold tracking-[-0.03em]">Choose a plan</h1>
          <p className="mx-auto mt-2 max-w-md text-[15px] text-muted">
            Credits power every image, video and Skill run. Pick a monthly or yearly plan — cancel anytime.
          </p>

          <div className="mt-6 inline-flex rounded-full border border-line bg-surface p-1">
            {(['monthly', 'yearly'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setInterval(k)}
                className={cn(
                  'rounded-full px-5 py-1.5 text-sm font-semibold transition-colors',
                  interval === k ? 'bg-ink text-surface' : 'text-muted hover:text-ink',
                )}
              >
                {k === 'monthly' ? 'Monthly' : 'Yearly'}
              </button>
            ))}
          </div>
        </div>

        {sub && sub.status === 'active' && (
          <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-orange-deep" />
              <div>
                <div className="text-sm font-semibold capitalize">
                  {sub.planKey} · {sub.billingInterval}
                </div>
                <div className="text-[12px] text-muted-2">
                  {sub.cancelAtPeriodEnd ? 'Cancels at period end' : 'Active subscription'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void manage()}
              disabled={busy === 'portal'}
              className="rounded-full border border-ink px-4 py-2 text-sm font-semibold transition-colors hover:bg-ink hover:text-surface disabled:opacity-40"
            >
              Manage subscription
            </button>
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => {
            const price = interval === 'monthly' ? plan.monthly : plan.yearly;
            return (
              <div
                key={plan.key}
                className="flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-card"
              >
                <div className="text-[15px] font-bold tracking-tight">{plan.name}</div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-[1.75rem] font-bold tracking-[-0.03em]">${price}</span>
                  <span className="text-[13px] text-muted-2">/ {interval === 'monthly' ? 'mo' : 'yr'}</span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{plan.blurb}</p>
                <ul className="mt-4 flex-1 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13px] text-ink-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 flex-none text-orange-deep" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => {
                    void subscribe(plan.key).catch(() => {});
                  }}
                  disabled={busy === plan.key}
                  className="mt-5 w-full rounded-full bg-ink py-2.5 text-sm font-semibold text-surface shadow-[0_1px_2px_rgba(10,10,10,.16),0_10px_22px_-10px_rgba(10,10,10,.5)] transition-transform duration-200 hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40"
                >
                  {sub?.planKey === plan.key ? 'Current plan' : busy === plan.key ? 'Redirecting…' : 'Subscribe'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
