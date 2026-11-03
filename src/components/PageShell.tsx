import type { ReactNode } from 'react';
import { ArrowLeft, Menu } from 'lucide-react';
import { cn } from '../lib/utils';

interface PageShellProps {
  title: string;
  onBack: () => void;
  onOpenNav: () => void;
  actions?: ReactNode;
  width?: 'narrow' | 'default' | 'wide';
  children: ReactNode;
}

const WIDTHS = {
  narrow: 'max-w-2xl',
  default: 'max-w-3xl',
  wide: 'max-w-5xl',
} as const;

/**
 * Shared chrome for the account and billing pages. Below lg the sidebar is a
 * drawer, so the header carries the menu button and drops the redundant
 * "Back to chat" link.
 */
export default function PageShell({
  title,
  onBack,
  onOpenNav,
  actions,
  width = 'narrow',
  children,
}: PageShellProps) {
  return (
    <main className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto">
      <header className="sticky top-0 z-20 flex items-center gap-1 border-b border-line bg-surface/80 px-3 py-2.5 backdrop-blur sm:gap-2 sm:px-6 sm:py-3">
        <button type="button" onClick={onOpenNav} aria-label="Open menu" className="icon-btn lg:hidden">
          <Menu className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onBack}
          className="hidden items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-muted transition-colors hover:text-ink lg:flex"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to chat
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold tracking-tight">{title}</div>
        </div>
        {actions}
      </header>
      <div className={cn('mx-auto w-full px-4 py-8 sm:px-6 sm:py-10', WIDTHS[width])}>{children}</div>
    </main>
  );
}
