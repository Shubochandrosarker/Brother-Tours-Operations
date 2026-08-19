import React, { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { ExternalLink } from 'lucide-react';
import { fetchSiteCron, fetchSiteOverview, fetchSitePlugins, fetchSiteUsers } from '@/api/site';
import { ApiError } from '@/api/client';
import { ErrorState, SkeletonPanel, UnavailableState } from '@/components/states/StateViews';
import { formatDate } from '@/lib/format';

export default function SitePage() {
  const [state, setState] = useState('LOADING');
  const [error, setError] = useState(null);
  const [data, setData] = useState({ overview: null, plugins: null, users: null, cron: null });

  const load = useCallback(async () => {
    setState('LOADING');
    setError(null);
    try {
      // Four independent reads, in parallel — none blocks the others.
      const [overview, plugins, users, cron] = await Promise.all([
        fetchSiteOverview(),
        fetchSitePlugins().catch(() => null),
        fetchSiteUsers().catch(() => null),
        fetchSiteCron().catch(() => null),
      ]);
      setData({ overview, plugins, users, cron });
      setState('DATA');
    } catch (err) {
      setError(err);
      setState(err instanceof ApiError && err.isUnavailable ? 'UNAVAILABLE' : 'ERROR');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (state === 'LOADING') return <SkeletonPanel rows={10} />;
  if (state === 'UNAVAILABLE') return <UnavailableState error={error} onRetry={load} />;
  if (state === 'ERROR') return <ErrorState error={error} onRetry={load} />;

  const { overview, plugins, users, cron } = data;

  return (
    <>
      <Helmet><title>WordPress Site · Brother Tours Operations</title><meta name="robots" content="noindex,nofollow" /></Helmet>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">WordPress Site</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Read-only. Plugin activation, updates and user creation stay in wp-admin.
            </p>
          </div>
          {overview?.adminUrl && (
            <a href={overview.adminUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-secondary">
              <ExternalLink className="h-4 w-4" />Open wp-admin
            </a>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="WordPress" value={overview?.wpVersion || '—'} />
          <Stat label="PHP" value={overview?.phpVersion || '—'} />
          <Stat label="Theme" value={overview?.theme?.name ? `${overview.theme.name} ${overview.theme.version || ''}`.trim() : '—'} />
          <Stat label="Timezone" value={overview?.timezone || '—'} />
        </div>

        {overview?.contentTypes?.length > 0 && (
          <Panel title="Content">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 font-semibold">Type</th>
                    <th className="px-2 py-2 text-right font-semibold">Published</th>
                    <th className="px-2 py-2 text-right font-semibold">Draft</th>
                    <th className="px-2 py-2 text-right font-semibold">Pending</th>
                    <th className="px-2 py-2 text-right font-semibold">Trash</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.contentTypes.map((row) => (
                    <tr key={row.type} className="border-b border-border last:border-0">
                      <td className="px-2 py-2 font-medium">{row.label}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{row.publish}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{row.draft}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{row.pending}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{row.trash}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {overview.mediaCount} media items · {overview.userCount} users · {overview.activePlugins} active plugins
            </p>
          </Panel>
        )}

        {users?.items?.length > 0 && (
          <Panel title="Users">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 font-semibold">Name</th>
                    <th className="px-2 py-2 font-semibold">Roles</th>
                    <th className="px-2 py-2 font-semibold">Can edit content</th>
                    <th className="px-2 py-2 text-right font-semibold">Posts</th>
                  </tr>
                </thead>
                <tbody>
                  {users.items.map((user) => (
                    <tr key={user.id} className="border-b border-border last:border-0">
                      <td className="px-2 py-2 font-medium">{user.displayName}</td>
                      <td className="px-2 py-2 text-muted-foreground">{user.roles.join(', ')}</td>
                      <td className="px-2 py-2">
                        {/* Surfaced because bt_manage_operations does not imply
                            edit_posts — six of seven ops roles cannot edit. */}
                        {user.canEditPosts
                          ? <span className="text-emerald-600 dark:text-emerald-400">Yes</span>
                          : <span className="text-muted-foreground">No</span>}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{user.postCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {cron && (
          <Panel title="Scheduled tasks">
            {cron.cronDisabled && (
              <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-700 dark:text-amber-400">
                DISABLE_WP_CRON is set — these run only via a system cron.
              </p>
            )}
            {cron.items?.length > 0 ? (
              <ul className="space-y-1.5 text-sm">
                {cron.items.map((item, index) => (
                  <li key={`${item.hook}-${index}`} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-1.5 last:border-0">
                    <code className="text-xs">{item.hook}</code>
                    <span className={item.overdue ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}>
                      {item.overdue ? 'Overdue · ' : ''}{formatDate(item.nextRun, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="py-4 text-center text-sm text-muted-foreground">No watched tasks scheduled.</p>}
          </Panel>
        )}

        {plugins?.items?.length > 0 && (
          <Panel title="Plugins">
            <ul className="space-y-1.5 text-sm">
              {plugins.items.map((plugin) => (
                <li key={plugin.file} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-1.5 last:border-0">
                  <span className="font-medium">{plugin.name}</span>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{plugin.version}</span>
                    <span className={plugin.active ? 'text-emerald-600 dark:text-emerald-400' : ''}>{plugin.active ? 'Active' : 'Inactive'}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1.5 truncate text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}
