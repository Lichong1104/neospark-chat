import { useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2, X } from 'lucide-react';
import { useAuth } from './AuthContext';
import Eyebrow from '../components/Eyebrow';
import { emailLogin, googleLoginUrl, sendEmailCode } from '../lib/api';

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.57-5.15 3.57-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.93-2.91l-3.87-3c-1.07.72-2.45 1.14-4.06 1.14-3.12 0-5.77-2.11-6.71-4.95H1.29v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.29a12 12 0 0 0 0 10.74l4-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44A11.98 11.98 0 0 0 1.29 6.63l4 3.09C6.23 6.88 8.88 4.77 12 4.77Z"
      />
    </svg>
  );
}

function errMsg(e: unknown): string {
  const err = e as { response?: { data?: { detail?: string } }; message?: string };
  return err?.response?.data?.detail || err?.message || 'Something went wrong. Please try again.';
}

export default function LoginModal() {
  const { loginModalOpen, closeLogin, refresh } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loginModalOpen) return null;

  const reset = () => {
    setStep('email');
    setEmail('');
    setCode('');
    setError(null);
  };

  const google = () => {
    // Carry the jump-in query through the OAuth round-trip so the intent
    // (skill + message + auto) survives a full-page Google redirect.
    window.location.href = googleLoginUrl(window.location.pathname + window.location.search);
  };

  const send = async () => {
    if (!email.includes('@') || busy) return;
    setError(null);
    setBusy(true);
    try {
      await sendEmailCode(email.trim());
      setStep('code');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (code.trim().length < 4 || busy) return;
    setError(null);
    setBusy(true);
    try {
      await emailLogin(email.trim(), code.trim());
      await refresh();
      reset();
      closeLogin();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    reset();
    closeLogin();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={close} />
      <div className="relative w-full max-w-sm rounded-2xl bg-surface p-7 shadow-panel">
        <button
          type="button"
          onClick={close}
          className="absolute right-4 top-4 rounded-full p-1.5 text-muted-2 transition-colors hover:bg-line-soft hover:text-ink"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <Eyebrow>Sign in</Eyebrow>
        <h2 className="mt-5 text-xl font-bold tracking-tight">Sign in to NeoSpark</h2>
        <p className="mt-1 text-sm text-muted">
          {step === 'email' ? 'Continue to the conversation platform to sync your Skills and history.' : `Code sent to ${email}`}
        </p>

        {step === 'email' ? (
          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={google}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface py-3 text-sm font-semibold shadow-card transition-colors hover:bg-paper"
            >
              <GoogleMark />
              Continue with Google
            </button>

            <div className="flex items-center gap-3 text-xs text-muted-2">
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="you@example.com"
              autoFocus
              className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm outline-none transition-colors focus:border-ink"
            />
            <button
              type="button"
              onClick={send}
              disabled={busy || !email.includes('@')}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3 text-sm font-semibold text-surface shadow-[0_1px_2px_rgba(10,10,10,.16),0_10px_22px_-10px_rgba(10,10,10,.5)] transition-opacity disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send code
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && verify()}
              placeholder="6-digit code"
              autoFocus
              className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-center font-mono text-lg tracking-[0.4em] outline-none transition-colors focus:border-ink"
            />
            <button
              type="button"
              onClick={verify}
              disabled={busy || code.trim().length < 4}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3 text-sm font-semibold text-surface shadow-[0_1px_2px_rgba(10,10,10,.16),0_10px_22px_-10px_rgba(10,10,10,.5)] transition-opacity disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Verify & sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('email');
                setCode('');
                setError(null);
              }}
              className="flex w-full items-center justify-center gap-1.5 py-1 text-xs font-semibold text-muted transition-colors hover:text-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Use a different email
            </button>
          </div>
        )}

        {error ? (
          <p className="mt-4 rounded-lg bg-orange/10 px-3 py-2 text-xs font-medium text-orange-deep">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
