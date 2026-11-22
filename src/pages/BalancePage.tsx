import { useEffect, useMemo, useState } from 'react';
import { Coins, Snowflake } from 'lucide-react';
import PageShell from '../components/PageShell';
import { useAuth } from '../auth/AuthContext';
import { getBalance, getBillingHistory, getSkillInvocation, listSkillInvocations } from '../lib/api';
import type { BalanceInfo, PointTransaction, SkillBilling, SkillInvocationDetail } from '../types';

interface SpendRow {
  key: string;
  runs: number;
  credits: number;
  refunded: number;
  freeRuns: number;
  failed: number;
}

const emptySpendRow = (key: string): SpendRow => ({
  key,
  runs: 0,
  credits: 0,
  refunded: 0,
  freeRuns: 0,
  failed: 0,
});

const statusText = (status: string): string => {
  if (status === 'failed') return 'failed · hold released';
  if (status === 'reserved') return 'holding credits';
  if (status === 'refunded') return 'refunded';
  return status;
};

function SpendTable({ title, rows, empty }: { title: string; rows: SpendRow[]; empty: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <div className="text-xs font-bold uppercase tracking-[0.12em] text-muted-2">{title}</div>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line-soft">
          {rows.slice(0, 6).map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <span className="min-w-0 truncate text-ink-2">{row.key}</span>
              <span className="flex-none text-right text-xs text-muted-2">
                {row.credits.toLocaleString('en-US')} cr
                {row.freeRuns > 0 ? ` · ${row.freeRuns} free` : ''}
                {row.failed > 0 ? ` · ${row.failed} failed` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function BalancePage({ onBack, onOpenNav }: { onBack: () => void; onOpenNav: () => void }) {
  const { user, openLogin } = useAuth();
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [invocations, setInvocations] = useState<SkillBilling[]>([]);
  const [details, setDetails] = useState<Record<number, SkillInvocationDetail>>({});
  const [openRun, setOpenRun] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getBalance().then(setBalance).catch(() => {});
    getBillingHistory(30).then(setTransactions).catch(() => {});
    listSkillInvocations(20)
      .then(async (res) => {
        if (cancelled) return;
        setInvocations(res.invocations);
        // Pull each run's split so the spend breakdown and row drill-down can
        // reuse one fetch. Three workers keep the burst off the API.
        const queue = [...res.invocations];
        const loaded: Record<number, SkillInvocationDetail> = {};
        const worker = async () => {
          for (;;) {
            const run = queue.shift();
            if (!run || cancelled) return;
            try {
              loaded[run.invocation_id] = await getSkillInvocation(run.invocation_id);
            } catch {
              // A missing detail only drops that run from the breakdown.
            }
            if (!cancelled) setDetails({ ...loaded });
          }
        };
        await Promise.all([worker(), worker(), worker()]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  const spend = useMemo(() => {
    const skills = new Map<string, SpendRow>();
    const assets = new Map<string, SpendRow>();
    const models = new Map<string, SpendRow>();
    const seen = new Set<string>();
    const bump = (map: Map<string, SpendRow>, key: string): SpendRow => {
      let row = map.get(key);
      if (!row) {
        row = emptySpendRow(key);
        map.set(key, row);
      }
      return row;
    };
    for (const run of invocations) {
      const detail = details[run.invocation_id];
      if (!detail) continue;
      for (const line of detail.skills) {
        const key = line.skill_id;
        const marker = `${run.invocation_id}:${key}`;
        if (!seen.has(marker)) {
          seen.add(marker);
          bump(skills, key).runs += 1;
        }
        const row = bump(skills, key);
        row.credits += line.skill_fee_credits;
        row.refunded += line.refunded_credits;
        if (line.free_quota_applied) row.freeRuns += 1;
      }
      for (const asset of detail.assets) {
        const row = bump(assets, asset.asset_type || 'unknown');
        row.runs += 1;
        row.credits += asset.credits;
        if (asset.status === 'failed') row.failed += 1;
        const modelRow = bump(models, asset.model || asset.provider || 'Unknown');
        modelRow.credits += asset.credits;
        modelRow.runs += 1;
      }
      if (detail.token_credits > 0) {
        const row = bump(models, detail.model || 'Unknown');
        row.credits += detail.token_credits;
        row.runs += 1;
      }
    }
    const sorted = (map: Map<string, SpendRow>) =>
      [...map.values()].sort((a, b) => b.credits - a.credits);
    return { skills: sorted(skills), assets: sorted(assets), models: sorted(models) };
  }, [invocations, details]);

  const hasSpend = spend.skills.length + spend.assets.length + spend.models.length > 0;

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

            {hasSpend && (
              <>
                <h2 className="mt-10 text-xl font-bold tracking-[-0.02em]">Spend breakdown</h2>
                <p className="mt-1 text-sm text-muted">
                  Last {invocations.length} runs, grouped by Skill fee, asset type and model. Open a
                  run below for its line items.
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <SpendTable title="By Skill" rows={spend.skills} empty="No Skill fees yet." />
                  <SpendTable title="By asset type" rows={spend.assets} empty="No asset charges yet." />
                  <SpendTable title="By model" rows={spend.models} empty="No model usage yet." />
                </div>
              </>
            )}

            <h2 className="mt-10 text-xl font-bold tracking-[-0.02em]">Skill runs</h2>
            <p className="mt-1 text-sm text-muted">
              Each run settles its Skill fee, token cost and image/video assets separately; refunds
              and free-quota uses are shown per run.
            </p>
            {invocations.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No Skill runs yet.</p>
            ) : (
              <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
                <ul className="divide-y divide-line-soft">
                  {invocations.map((run) => {
                    const charged =
                      run.status === 'failed' ? 0 : run.charged_credits ?? run.total_credits;
                    const detail = details[run.invocation_id];
                    const expanded = openRun === run.invocation_id;
                    return (
                      <li key={run.invocation_id}>
                        <button
                          type="button"
                          aria-expanded={expanded}
                          onClick={() => setOpenRun(expanded ? null : run.invocation_id)}
                          className="w-full px-4 py-3 text-left transition-colors hover:bg-paper"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-ink-2">
                                {run.skill_count > 1 ? `${run.skill_count} Skills` : run.skill_id || 'Skill run'}
                              </span>
                              <span
                                className={`text-xs ${
                                  run.status === 'failed'
                                    ? 'font-semibold text-danger'
                                    : run.status === 'reserved'
                                      ? 'text-orange-ink'
                                      : 'text-muted-2'
                                }`}
                              >
                                {statusText(run.status)}
                              </span>
                              {run.free_quota_applied && (
                                <span className="rounded-full bg-orange/15 px-2 py-0.5 text-micro font-bold uppercase tracking-[0.08em] text-orange-ink">
                                  Free quota
                                </span>
                              )}
                              {run.partial_success && (
                                <span className="rounded-full bg-yellow/25 px-2 py-0.5 text-micro font-bold uppercase tracking-[0.08em] text-ink">
                                  Partial
                                </span>
                              )}
                            </div>
                            <div
                              className={`text-right text-sm font-bold ${
                                run.status === 'failed' ? 'text-muted-2' : 'text-ink'
                              }`}
                            >
                              {run.status === 'failed'
                                ? '0 charged'
                                : `-${charged.toLocaleString('en-US')}`}
                            </div>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-2">
                            <span>Skill fee {run.skill_fee_credits}</span>
                            <span>Tokens {run.token_credits}</span>
                            <span>
                              Assets {run.asset_credits} ({run.asset_item_count})
                            </span>
                            {run.refunded_credits > 0 && (
                              <span className="font-semibold text-success">
                                Refunded +{run.refunded_credits.toLocaleString('en-US')}
                              </span>
                            )}
                          </div>
                        </button>
                        {expanded && (
                          <div className="border-t border-line-soft bg-paper/60 px-4 py-3 text-xs">
                            {detail ? (
                              <>
                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-2">
                                  <span>Model {detail.model || '—'}</span>
                                  <span>
                                    Tokens {detail.token_credits} (
                                    {(detail.input_tokens + detail.output_tokens).toLocaleString('en-US')} tokens)
                                  </span>
                                  <span>Assets {detail.asset_credits}</span>
                                  {detail.error_code && (
                                    <span className="font-semibold text-danger">
                                      Error {detail.error_code}
                                    </span>
                                  )}
                                </div>
                                {detail.skills.length > 0 && (
                                  <ul className="mt-2 space-y-1 border-t border-line-soft pt-2">
                                    {detail.skills.map((line) => (
                                      <li
                                        key={line.skill_id}
                                        className="flex items-center justify-between gap-2"
                                      >
                                        <span className="font-medium text-ink-2">{line.skill_id}</span>
                                        <span className="text-muted-2">
                                          {line.free_quota_applied
                                            ? 'free quota'
                                            : `${line.skill_fee_credits} credits`}
                                          {line.refunded_credits > 0
                                            ? ` · ${line.refunded_credits} refunded`
                                            : ''}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {detail.assets.length > 0 && (
                                  <ul className="mt-2 space-y-1 border-t border-line-soft pt-2">
                                    {detail.assets.map((asset) => (
                                      <li
                                        key={asset.id}
                                        className={`flex items-center justify-between gap-2 ${
                                          asset.status === 'failed' ? 'text-muted-2' : ''
                                        }`}
                                      >
                                        <span>
                                          {asset.asset_type} · {asset.model || asset.provider || 'task'}
                                          {asset.quantity > 1 ? ` ×${asset.quantity}` : ''}
                                        </span>
                                        <span
                                          className={
                                            asset.status === 'failed' ? '' : 'font-medium text-ink-2'
                                          }
                                        >
                                          {asset.status === 'failed'
                                            ? `failed${asset.error_code ? ` (${asset.error_code})` : ''}`
                                            : `${asset.credits} credits`}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </>
                            ) : (
                              <div className="text-muted-2">Loading line items…</div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
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
