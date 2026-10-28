import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Check, Copy, KeyRound, Loader2, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { createApiKey, deleteApiKey, listApiKeys, updateApiKey } from '../lib/api';
import type { ApiKeyItem, ApiKeyListData, CreatedApiKey } from '../types';
import { cn } from '../lib/utils';

function fmt(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function StatusPill({ status }: { status: ApiKeyItem['status'] }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        status === 'active' && 'bg-yellow/60 text-ink',
        status === 'expired' && 'bg-orange/15 text-orange-deep',
        status === 'inactive' && 'bg-line-soft text-muted-2',
      )}
    >
      {status}
    </span>
  );
}

export default function ApiKeysPage({ onBack }: { onBack: () => void }) {
  const { user, openLogin } = useAuth();
  const [data, setData] = useState<ApiKeyListData | null>(null);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [expires, setExpires] = useState('none');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);

  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ApiKeyItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    listApiKeys()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    refresh();
  }, [user, refresh]);

  const submitCreate = async () => {
    const name = keyName.trim();
    if (!name) {
      toast.error('Give the key a name');
      return;
    }
    setCreating(true);
    try {
      const days = expires === 'none' ? null : Number(expires);
      const result = await createApiKey(name, days);
      if (!result) throw new Error('no key');
      setCreateOpen(false);
      setKeyName('');
      setExpires('none');
      setCreated(result);
      setCopied(false);
      refresh();
    } catch {
      toast.error('Could not create the API key');
    } finally {
      setCreating(false);
    }
  };

  const copyKey = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.api_key);
      setCopied(true);
      toast.success('API key copied');
    } catch {
      toast.error('Copy failed — select the key and copy it manually');
    }
  };

  const toggleKey = async (key: ApiKeyItem) => {
    setUpdatingId(key.id);
    try {
      await updateApiKey(key.id, { is_active: !key.is_active });
      toast.success(key.is_active ? 'API key disabled' : 'API key enabled');
      refresh();
    } catch {
      toast.error('Could not update the API key');
    } finally {
      setUpdatingId(null);
    }
  };

  const removeKey = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteApiKey(pendingDelete.id);
      toast.success('API key deleted');
      setPendingDelete(null);
      refresh();
    } catch {
      toast.error('Could not delete the API key');
    } finally {
      setDeleting(false);
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
          <div className="truncate text-sm font-bold tracking-tight">API Key</div>
        </div>
        {user && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-1.5 text-[12px] font-bold text-surface transition-transform hover:-translate-y-0.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Create key
          </button>
        )}
      </header>

      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        {!user ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
            <p className="text-[15px] text-muted">Sign in to manage your API keys.</p>
            <button type="button" onClick={openLogin} className="mt-4 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-surface">
              Sign in
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-[1.5rem] font-bold tracking-[-0.03em]">API keys</h1>
            <p className="mt-1 text-[14px] text-muted">
              Keys let your own scripts and agents call the NeoSpark API. Send them as the{' '}
              <code className="rounded bg-line-soft px-1.5 py-0.5 font-mono text-[12px]">X-API-Key</code> header.
            </p>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-2" />
              </div>
            ) : !data || data.items.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-line bg-surface p-10 text-center shadow-card">
                <KeyRound className="mx-auto h-8 w-8 text-muted-2" />
                <p className="mt-3 text-[14px] font-semibold">No API keys yet</p>
                <p className="mt-1 text-[13px] text-muted">Create one to connect your scripts or MCP clients.</p>
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="mt-4 rounded-full bg-ink px-5 py-2 text-[13px] font-bold text-surface"
                >
                  Create key
                </button>
              </div>
            ) : (
              <ul className="mt-6 space-y-2.5">
                {data.items.map((key) => (
                  <li key={key.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-line-soft text-ink">
                      <KeyRound className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-bold">{key.name}</span>
                        <StatusPill status={key.status} />
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-muted-2">
                        Created {fmt(key.created_at)} · Last used {key.last_used_at ? fmt(key.last_used_at) : 'never'} · Expires{' '}
                        {fmt(key.expires_at)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void toggleKey(key)}
                      disabled={updatingId === key.id}
                      className="flex-none rounded-full border border-line px-3 py-1 text-[11px] font-bold text-ink transition-colors hover:border-ink disabled:opacity-60"
                    >
                      {updatingId === key.id ? <Loader2 className="h-3 w-3 animate-spin" /> : key.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(key)}
                      title="Delete key"
                      className="flex-none rounded-lg p-2 text-muted-2 transition-colors hover:bg-orange/5 hover:text-orange-dark"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {/* Create dialog */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setCreateOpen(false)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-surface p-6 shadow-panel" role="dialog" aria-modal="true">
            <div className="flex items-start">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold tracking-tight">Create API key</h3>
                <p className="mt-1 text-[12px] text-muted">The key is shown once. Store it somewhere safe.</p>
              </div>
              <button type="button" onClick={() => setCreateOpen(false)} className="rounded-md p-1 text-muted-2 hover:bg-paper hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mt-4 block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.12em] text-muted-2">Name</span>
              <input
                value={keyName}
                onChange={(event) => setKeyName(event.target.value)}
                placeholder="e.g. n8n workflow"
                autoFocus
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] outline-none focus:border-ink"
              />
            </label>

            <label className="mt-3 block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.12em] text-muted-2">Expires</span>
              <select
                value={expires}
                onChange={(event) => setExpires(event.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] outline-none focus:border-ink"
              >
                <option value="none">Never</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="365">1 year</option>
              </select>
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-full px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitCreate()}
                disabled={creating}
                className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-surface disabled:opacity-60"
              >
                {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reveal dialog */}
      {created && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md rounded-2xl bg-surface p-6 shadow-panel" role="dialog" aria-modal="true">
            <h3 className="text-base font-bold tracking-tight">Your new API key</h3>
            <p className="mt-1 text-[12px] text-orange-dark">Copy it now — it will not be shown again.</p>

            <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-paper p-3">
              <code className="min-w-0 flex-1 break-all font-mono text-[12px]">{created.api_key}</code>
              <button
                type="button"
                onClick={() => void copyKey()}
                className="flex flex-none items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-bold text-ink hover:border-ink"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <p className="mt-3 text-[12px] text-muted">
              Use it as <code className="rounded bg-line-soft px-1 py-0.5 font-mono text-[11px]">X-API-Key: {created.api_key.slice(0, 8)}…</code>{' '}
              when calling the API.
            </p>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setCreated(null)}
                className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-surface"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete dialog */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setPendingDelete(null)} />
          <div className="relative w-full max-w-xs rounded-2xl bg-surface p-6 shadow-panel" role="dialog" aria-modal="true">
            <h3 className="text-base font-bold tracking-tight">Delete this key?</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              “{pendingDelete.name}” will stop working immediately. This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="rounded-full px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void removeKey()}
                disabled={deleting}
                className="flex items-center gap-1.5 rounded-full bg-orange-dark px-4 py-2 text-sm font-semibold text-surface disabled:opacity-60"
              >
                {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
