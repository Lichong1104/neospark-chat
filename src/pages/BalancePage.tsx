import { useEffect, useMemo, useState } from 'react';
import { Coins, Snowflake, Tag, Wallet } from 'lucide-react';
import PageShell from '../components/PageShell';
import { useAuth } from '../auth/AuthContext';
import {
  getBalance,
  getBillingHistory,
  getCreatorAccount,
  getCreatorEarnings,
  getSkillInvocation,
  listSkillInvocations,
} from '../lib/api';
import type {
  BalanceInfo,
  CreatorAccount,
  CreatorLedgerEntry,
  PointTransaction,
  SkillBilling,
  SkillInvocationDetail,
} from '../types';

interface SpendRow {
  key: string;
  runs: number;
  credits: number;
  refunded: number;
  freeRuns: number;
  failed: number;
}

interface CategoryRow {
  key: string;
  label: string;
  credits: number;
  count: number;
}

interface ModelCallRow {
  key: string;
  tag: string;
  label: string;
  credits: number;
  detailText: string;
  status: string;
  error: string | null;
  time: string | null;
  invocationId: number;
}

const emptySpendRow = (key: string): SpendRow => ({
  key,
  runs: 0,
  credits: 0,
  refunded: 0,
  freeRuns: 0,
  failed: 0,
});

const USAGE_PAGE_SIZE = 10;

const statusText = (status: string): string => {
  if (status === 'failed') return 'failed · hold released';
  if (status === 'reserved') return 'holding credits';
  if (status === 'refunded') return 'refunded';
  return status;
};

const earningSourceLabel = (source: string): string => {
  if (source === 'compute') return 'Compute share';
  if (source === 'skill_fee') return 'Skill fee share';
  if (source === 'payout') return 'Payout';
  return 'Adjustment';
};

const earningStatusLabel = (status: string): string => {
  if (status === 'pending') return 'Locked';
  if (status === 'available') return 'Available';
  if (status === 'reversed') return 'Reversed';
  if (status === 'paid') return 'Paid';
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
  const [creator, setCreator] = useState<CreatorAccount | null>(null);
  const [earnings, setEarnings] = useState<CreatorLedgerEntry[]>([]);
  const [usagePage, setUsagePage] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getBalance().then(setBalance).catch(() => {});
    getBillingHistory(20).then(setTransactions).catch(() => {});
    getCreatorAccount().then(setCreator).catch(() => {});
    getCreatorEarnings().then(setEarnings).catch(() => {});
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
    const llmModels = new Map<string, SpendRow>();
    const imageModels = new Map<string, SpendRow>();
    const videoModels = new Map<string, SpendRow>();
    const otherModels = new Map<string, SpendRow>();
    const categories = new Map<string, CategoryRow>();
    const seen = new Set<string>();
    const bumpCategory = (key: string, label: string): CategoryRow => {
      let row = categories.get(key);
      if (!row) {
        row = { key, label, credits: 0, count: 0 };
        categories.set(key, row);
      }
      return row;
    };
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
        // Split asset spend into image vs video generation; the rest
        // (bg removal / layer / upscale / angles) is grouped as other compute.
        const catKey =
          asset.asset_type === 'image' || asset.asset_type === 'video' ? asset.asset_type : 'other';
        const catLabel =
          catKey === 'image'
            ? 'Image generation'
            : catKey === 'video'
              ? 'Video generation'
              : 'Other compute';
        const cat = bumpCategory(catKey, catLabel);
        cat.credits += asset.credits;
        cat.count += asset.quantity > 0 ? asset.quantity : 1;
        const modelLabel = [asset.provider, asset.model].filter(Boolean).join(' · ') || 'Unknown';
        const modelMap =
          catKey === 'image' ? imageModels : catKey === 'video' ? videoModels : otherModels;
        const modelRow = bump(modelMap, modelLabel);
        modelRow.credits += asset.credits;
        modelRow.runs += 1;
      }
      if (detail.token_credits > 0) {
        const row = bump(llmModels, detail.model || 'Unknown');
        row.credits += detail.token_credits;
        row.runs += 1;
        const llm = bumpCategory('llm', 'LLM calls (tokens)');
        llm.credits += detail.token_credits;
        llm.count += 1;
      }
    }
    const sorted = (map: Map<string, SpendRow>) =>
      [...map.values()].sort((a, b) => b.credits - a.credits);
    const categoryOrder = ['image', 'video', 'llm', 'other'];
    const categoryRows = categoryOrder
      .map((key) => categories.get(key))
      .filter((row): row is CategoryRow => Boolean(row));
    return {
      skills: sorted(skills),
      assets: sorted(assets),
      llmModels: sorted(llmModels),
      imageModels: sorted(imageModels),
      videoModels: sorted(videoModels),
      otherModels: sorted(otherModels),
      categories: categoryRows,
    };
  }, [invocations, details]);

  const modelCalls = useMemo(() => {
    const rows: ModelCallRow[] = [];
    for (const detail of Object.values(details)) {
      if (detail.token_credits > 0) {
        rows.push({
          key: `llm:${detail.invocation_id}`,
          tag: 'LLM',
          label: detail.model || 'Unknown model',
          credits: detail.token_credits,
          detailText: `in ${detail.input_tokens.toLocaleString('en-US')} / out ${detail.output_tokens.toLocaleString('en-US')}`,
          status: detail.error_code ? 'failed' : 'settled',
          error: detail.error_code,
          time: detail.settled_at || detail.created_at,
          invocationId: detail.invocation_id,
        });
      }
      for (const asset of detail.assets) {
        rows.push({
          key: `asset:${asset.id}`,
          tag: asset.asset_type || 'asset',
          label: [asset.provider, asset.model].filter(Boolean).join(' · ') || 'Unknown model',
          credits: asset.credits,
          detailText:
            asset.quantity > 1
              ? `${asset.unit_credits} cr × ${asset.quantity}`
              : `${asset.unit_credits} cr each`,
          status: asset.status,
          error: asset.error_code,
          time: asset.completed_at || asset.created_at,
          invocationId: detail.invocation_id,
        });
      }
    }
    rows.sort((a, b) => {
      const at = a.time ? new Date(a.time).getTime() : 0;
      const bt = b.time ? new Date(b.time).getTime() : 0;
      return bt - at;
    });
    return rows;
  }, [details]);

  const hasSpend =
    spend.skills.length +
      spend.assets.length +
      spend.llmModels.length +
      spend.imageModels.length +
      spend.videoModels.length +
      spend.otherModels.length >
    0;

  const usagePageCount = Math.max(1, Math.ceil(transactions.length / USAGE_PAGE_SIZE));
  const safeUsagePage = Math.min(usagePage, usagePageCount - 1);
  const usageSlice = transactions.slice(
    safeUsagePage * USAGE_PAGE_SIZE,
    safeUsagePage * USAGE_PAGE_SIZE + USAGE_PAGE_SIZE,
  );

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

            {creator && (
              <>
                <h2 className="mt-10 text-xl font-bold tracking-[-0.02em]">Creator earnings</h2>
                <p className="mt-1 text-sm text-muted">
                  Skill fee share (70%) and compute share (30%). Locked earnings release
                  automatically after the hold period.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-2">
                      <Coins className="h-4 w-4" />
                      Available
                    </div>
                    <div className="mt-1.5 text-2xl font-bold tracking-[-0.03em]">
                      {creator.available_credits.toLocaleString('en-US')}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-2">
                      <Snowflake className="h-4 w-4" />
                      Locked
                    </div>
                    <div className="mt-1.5 text-2xl font-bold tracking-[-0.03em]">
                      {creator.pending_credits.toLocaleString('en-US')}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-2">
                      <Wallet className="h-4 w-4" />
                      In payout
                    </div>
                    <div className="mt-1.5 text-2xl font-bold tracking-[-0.03em]">
                      {creator.frozen_credits.toLocaleString('en-US')}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-2">
                      <Tag className="h-4 w-4" />
                      Total earned
                    </div>
                    <div className="mt-1.5 text-2xl font-bold tracking-[-0.03em]">
                      {creator.total_earned_credits.toLocaleString('en-US')}
                    </div>
                  </div>
                </div>

                {earnings.length > 0 ? (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
                    <div className="flex items-center justify-between border-b border-line-soft px-4 py-2.5">
                      <span className="text-xs font-bold uppercase tracking-[0.1em] text-muted-2">
                        Recent earnings
                      </span>
                      <span className="text-xs text-muted-2">Latest {earnings.length}</span>
                    </div>
                    <ul className="divide-y divide-line-soft">
                      {earnings.map((row) => (
                        <li
                          key={row.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{row.skill_id ?? '—'}</div>
                            <div className="text-xs text-muted-2">
                              {earningSourceLabel(row.source)} · {earningStatusLabel(row.status)}
                              {row.status === 'pending' && row.available_at
                                ? ` · unlocks ${new Date(row.available_at).toLocaleDateString('en-US')}`
                                : ''}
                            </div>
                          </div>
                          <div
                            className={`flex-none font-mono text-sm font-semibold ${
                              row.credits < 0 ? 'text-danger' : 'text-success'
                            }`}
                          >
                            {row.credits > 0
                              ? `+${row.credits.toLocaleString('en-US')}`
                              : row.credits.toLocaleString('en-US')}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted">
                    No creator earnings yet. Publish a paid Skill to start earning.
                  </p>
                )}
              </>
            )}

            {hasSpend && (
              <>
                <h2 className="mt-10 text-xl font-bold tracking-[-0.02em]">Spend breakdown</h2>
                <p className="mt-1 text-sm text-muted">
                  Last {invocations.length} runs, split by category (image generation, video
                  generation, LLM tokens, other compute), then by Skill fee, asset type and model.
                </p>
                {spend.categories.length > 0 && (
                  <div className="mt-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
                    <div className="text-xs font-bold uppercase tracking-[0.12em] text-muted-2">
                      By category
                    </div>
                    <ul className="mt-2 divide-y divide-line-soft">
                      {spend.categories.map((row) => (
                        <li key={row.key} className="flex items-center justify-between gap-3 py-2 text-sm">
                          <span className="font-medium text-ink-2">{row.label}</span>
                          <span className="flex-none text-right text-xs text-muted-2">
                            {row.credits.toLocaleString('en-US')} cr · {row.count}
                            {row.key === 'llm' ? ' calls' : ' tasks'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <SpendTable title="By Skill" rows={spend.skills} empty="No Skill fees yet." />
                  <SpendTable title="By asset type" rows={spend.assets} empty="No asset charges yet." />
                </div>
                <h3 className="mt-6 text-sm font-bold uppercase tracking-[0.1em] text-muted-2">
                  By model
                </h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  <SpendTable title="LLM models" rows={spend.llmModels} empty="No LLM usage yet." />
                  <SpendTable title="Image models" rows={spend.imageModels} empty="No image models yet." />
                  <SpendTable title="Video models" rows={spend.videoModels} empty="No video models yet." />
                  {spend.otherModels.length > 0 && (
                    <SpendTable
                      title="Other compute models"
                      rows={spend.otherModels}
                      empty="No other compute yet."
                    />
                  )}
                </div>
              </>
            )}

            {modelCalls.length > 0 && (
              <>
                <h2 className="mt-10 text-xl font-bold tracking-[-0.02em]">Model calls</h2>
                <p className="mt-1 text-sm text-muted">
                  Each model task from your last {invocations.length} runs, newest first. LLM rows
                  show token usage; image/video rows show unit price × quantity.
                </p>
                <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
                  <div className="flex items-center justify-between border-b border-line-soft px-4 py-2.5">
                    <span className="text-xs font-bold uppercase tracking-[0.1em] text-muted-2">
                      Detail
                    </span>
                    <span className="text-xs text-muted-2">
                      Latest {Math.min(50, modelCalls.length)}
                      {modelCalls.length > 50 ? ` of ${modelCalls.length}` : ''}
                    </span>
                  </div>
                  <ul className="divide-y divide-line-soft">
                    {modelCalls.slice(0, 50).map((row) => (
                      <li
                        key={row.key}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                row.tag === 'LLM'
                                  ? 'flex-none rounded-full bg-orange/15 px-2 py-0.5 text-micro font-bold uppercase tracking-[0.08em] text-orange-ink'
                                  : 'flex-none rounded-full bg-line-soft px-2 py-0.5 text-micro font-bold uppercase tracking-[0.08em] text-muted-2'
                              }
                            >
                              {row.tag}
                            </span>
                            <span className="min-w-0 truncate text-sm font-semibold">{row.label}</span>
                          </div>
                          <div className="mt-0.5 text-xs text-muted-2">
                            {row.detailText} · run #{row.invocationId}
                            {row.time ? ` · ${new Date(row.time).toLocaleString('en-US')}` : ''}
                            {row.status === 'failed'
                              ? ` · failed${row.error ? ` (${row.error})` : ''}`
                              : ''}
                          </div>
                        </div>
                        <div
                          className={`flex-none font-mono text-sm font-semibold ${
                            row.status === 'failed' ? 'text-muted-2' : 'text-ink'
                          }`}
                        >
                          {row.status === 'failed'
                            ? 'failed'
                            : `${row.credits.toLocaleString('en-US')} cr`}
                        </div>
                      </li>
                    ))}
                  </ul>
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
                                    Tokens {detail.token_credits} (in{' '}
                                    {detail.input_tokens.toLocaleString('en-US')} / out{' '}
                                    {detail.output_tokens.toLocaleString('en-US')})
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
                                          {asset.asset_type} ·{' '}
                                          {[asset.provider, asset.model].filter(Boolean).join(' · ') ||
                                            'task'}
                                        </span>
                                        <span
                                          className={
                                            asset.status === 'failed' ? '' : 'font-medium text-ink-2'
                                          }
                                        >
                                          {asset.status === 'failed'
                                            ? `failed${asset.error_code ? ` (${asset.error_code})` : ''}`
                                            : asset.quantity > 1
                                              ? `${asset.unit_credits} cr × ${asset.quantity} = ${asset.credits}`
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
            <p className="mt-1 text-sm text-muted">
              Latest {transactions.length} ledger entries, {USAGE_PAGE_SIZE} per page.
            </p>
            {transactions.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No usage yet.</p>
            ) : (
              <>
                <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
                  <ul className="divide-y divide-line-soft">
                    {usageSlice.map((t) => {
                      const isDebit =
                        t.type === 'consume' || t.type === 'reserve' || t.type === 'expire';
                      const isCredit = t.type === 'grant' || t.type === 'release';
                      const sign = isDebit ? '-' : isCredit ? '+' : t.points >= 0 ? '+' : '';
                      return (
                        <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold">{t.type_name}</div>
                            <div className="truncate text-xs text-muted-2">
                              {t.description || t.biz_type || ''}
                              {t.created_at
                                ? ` · ${new Date(t.created_at).toLocaleString('en-US')}`
                                : ''}
                            </div>
                          </div>
                          <div
                            className={`flex-none text-sm font-bold ${isCredit ? 'text-success' : 'text-ink'}`}
                          >
                            {sign}
                            {Math.abs(t.points).toLocaleString('en-US')}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                {usagePageCount > 1 && (
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-2">
                      Page {safeUsagePage + 1} / {usagePageCount}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setUsagePage(Math.max(0, safeUsagePage - 1))}
                        disabled={safeUsagePage === 0}
                        className="min-h-8 rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted-2 transition-colors hover:text-ink disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => setUsagePage(Math.min(usagePageCount - 1, safeUsagePage + 1))}
                        disabled={safeUsagePage >= usagePageCount - 1}
                        className="min-h-8 rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted-2 transition-colors hover:text-ink disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
    </PageShell>
  );
}
