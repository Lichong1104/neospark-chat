import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

/** The catalogue's signature label pill — a live orange dot rather than a caption. */
export default function Eyebrow({
  children,
  className,
  dot = true,
}: {
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span className={cn('eyebrow', className)}>
      {dot && (
        <span className="pulse" aria-hidden="true">
          <span className="pulse-core" />
          <span className="pulse-ring" />
        </span>
      )}
      {children}
    </span>
  );
}
