import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

/**
 * Route-level capability gate.
 *
 * Hiding a nav item is not access control — the server enforces every check
 * independently. This exists so that typing a URL directly renders a clean
 * "not permitted" state instead of a page that mounts, fires a request and
 * falls over on a 403 response it did not expect.
 */
export default function RequireCapability({ capability, children }) {
  const { user } = useAuth();
  const capabilities = Array.isArray(user?.capabilities) ? user.capabilities : [];

  if (!capability || capabilities.includes(capability)) return children;

  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <ShieldAlert className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <h1 className="mt-4 text-sm font-semibold text-foreground">This section is not available to your account</h1>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
        It requires the <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">{capability}</code> capability in
        WordPress. Signing in to operations does not grant content permissions on its own — ask an administrator if you
        need access.
      </p>
      <Link
        to="/"
        className="mt-5 inline-flex h-9 items-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition hover:bg-secondary"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
