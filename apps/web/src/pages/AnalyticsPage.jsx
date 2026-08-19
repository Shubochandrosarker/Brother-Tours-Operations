import React, { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Activity, Gauge, Search, TriangleAlert } from 'lucide-react';
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  fetchAnalyticsStatus, fetchGa4, fetchNotFoundLog, fetchPageSpeed, fetchSearchConsole, runPageSpeed,
} from '@/api/analytics';
import { ApiError } from '@/api/client';
import { EmptyState, ErrorState, SkeletonPanel, UnavailableState } from '@/components/states/StateViews';
import { formatDate } from '@/lib/format';

const TABS = [
  { id: 'search-console', label: 'Search Console', icon: Search },
  { id: 'ga4', label: 'Traffic (GA4)', icon: Activity },
  { id: 'pagespeed', label: 'PageSpeed', icon: Gauge },
  { id: '404s', label: '404s', icon: TriangleAlert },
];

export default function AnalyticsPage() {
  const [tab, setTab] = useState('search-console');
  const [days, setDays] = useState(28);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchAnalyticsStatus(controller.signal).then(setStatus).catch(() => setStatus(null));
    return () => controller.abort();
  }, []);

  return (
    <>
      <Helmet><title>Analytics · Brother Tours Operations</title><meta name="robots" content="noindex,nofollow" /></Helmet>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Analytics &amp; SEO</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Live Google data via the Insightistic plugin. Read-only — Insightistic owns the sync.
            </p>
          </div>
          <select
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={28}>Last 28 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>

        {status && <IntegrationStrip status={status} />}

        <div className="flex flex-wrap gap-2 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition ${
                tab === t.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <t.icon className="h-4 w-4" />{t.label}
            </button>
          ))}
        </div>

        {tab === 'search-console' && <SearchConsoleTab days={days} />}
        {tab === 'ga4' && <Ga4Tab days={days} />}
        {tab === 'pagespeed' && <PageSpeedTab status={status} />}
        {tab === '404s' && <NotFoundTab />}
      </div>
    </>
  );
}

function IntegrationStrip({ status }) {
  const cells = [
    { label: 'GA4', ok: status?.ga4?.configured, detail: status?.ga4?.propertyId ? `Property ${status.ga4.propertyId}` : 'Not configured' },
    { label: 'Search Console', ok: status?.gsc?.configured, detail: status?.gsc?.property || 'Not configured' },
    { label: 'PageSpeed', ok: status?.pagespeed?.configured, detail: status?.pagespeed?.configured ? 'API key present' : 'Not configured' },
    { label: 'Insightistic', ok: status?.insightistic?.active, detail: status?.insightistic?.version ? `v${status.insightistic.version}` : 'Inactive' },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cells.map((cell) => (
        <div key={cell.label} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{cell.label}</p>
            <span className={`h-2 w-2 rounded-full ${cell.ok ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
          </div>
          <p className="mt-1.5 truncate text-sm text-foreground">{cell.detail}</p>
        </div>
      ))}
    </div>
  );
}

/** Shared loader: one state machine per tab, five canonical states. */
function useResource(loader, deps) {
  const [state, setState] = useState('LOADING');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setState('LOADING');
    setError(null);
    try {
      const payload = await loader();
      setData(payload);
      setState('DATA');
    } catch (err) {
      setError(err);
      if (err instanceof ApiError && err.status === 503) setState('UNAVAILABLE');
      else setState(err instanceof ApiError && err.isUnavailable ? 'UNAVAILABLE' : 'ERROR');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { load(); }, [load]);
  return { state, data, error, reload: load };
}

function SearchConsoleTab({ days }) {
  const { state, data, error, reload } = useResource(() => fetchSearchConsole(days), [days]);
  const [strikingDistance, setStrikingDistance] = useState(false);

  if (state === 'LOADING') return <SkeletonPanel rows={8} />;
  if (state === 'UNAVAILABLE') return <UnavailableState error={error} onRetry={reload} />;
  if (state === 'ERROR') return <ErrorState error={error} onRetry={reload} />;

  const daily = data?.daily || [];
  const totals = data?.totals || {};
  // Positions 5-20 are the striking-distance view: the pages a small change
  // can actually move onto page one. It is the filter that drives work.
  const queries = (data?.queries || []).filter((q) => !strikingDistance || (q.position >= 5 && q.position <= 20));

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Clicks" value={totals.clicks?.toLocaleString() ?? '—'} />
        <Kpi label="Impressions" value={totals.impressions?.toLocaleString() ?? '—'} />
        <Kpi label="CTR" value={totals.ctr != null ? `${(totals.ctr * 100).toFixed(2)}%` : '—'} />
        <Kpi label="Avg position" value={totals.avgPosition ?? '—'} />
      </div>

      {daily.length > 0 ? (
        <Panel title={`Clicks and impressions · last ${data?.days || days} days`}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="clicks" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Clicks" />
                <Line type="monotone" dataKey="impressions" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} dot={false} name="Impressions" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      ) : (
        <EmptyState title="No Search Console rows in range" description="Try a longer period." />
      )}

      <Panel
        title="Queries"
        action={
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={strikingDistance} onChange={(e) => setStrikingDistance(e.target.checked)} />
            Striking distance (position 5–20)
          </label>
        }
      >
        <DataTable
          columns={[
            { key: 'query', label: 'Query', className: 'font-medium' },
            { key: 'clicks', label: 'Clicks', numeric: true },
            { key: 'impressions', label: 'Impressions', numeric: true },
            { key: 'ctr', label: 'CTR', numeric: true, render: (v) => `${(Number(v) * 100).toFixed(1)}%` },
            { key: 'position', label: 'Position', numeric: true, render: (v) => Number(v).toFixed(1) },
          ]}
          rows={queries.slice(0, 100)}
          emptyLabel="No queries match this filter."
        />
      </Panel>

      <Panel title="Pages">
        <DataTable
          columns={[
            { key: 'page_path', label: 'Page', className: 'font-medium' },
            { key: 'clicks', label: 'Clicks', numeric: true },
            { key: 'impressions', label: 'Impressions', numeric: true },
            { key: 'ctr', label: 'CTR', numeric: true, render: (v) => `${(Number(v) * 100).toFixed(1)}%` },
            { key: 'position', label: 'Position', numeric: true, render: (v) => Number(v).toFixed(1) },
          ]}
          rows={(data?.pages || []).slice(0, 100)}
          emptyLabel="No pages in range."
        />
      </Panel>
    </div>
  );
}

function Ga4Tab({ days }) {
  const { state, data, error, reload } = useResource(() => fetchGa4(days), [days]);

  if (state === 'LOADING') return <SkeletonPanel rows={8} />;
  if (state === 'UNAVAILABLE') return <UnavailableState error={error} onRetry={reload} />;
  if (state === 'ERROR') return <ErrorState error={error} onRetry={reload} />;

  return (
    <div className="space-y-5">
      {/* The property returns channels but an empty daily series. Say so
          explicitly — an empty array rendered as a flat line would read as
          "zero traffic", which is a different and wrong claim. */}
      {!data?.dailyAvailable && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-semibold text-foreground">GA4 daily data unavailable</p>
            <p className="mt-1 leading-relaxed text-muted-foreground">
              The GA4 connection returns channel totals but no daily series for this range, so no time-series chart is
              shown. This is an open item — the channel figures below are real.
            </p>
          </div>
        </div>
      )}

      <Panel title="Channels">
        <DataTable
          columns={[
            { key: 'dimension_value', label: 'Channel', className: 'font-medium' },
            { key: 'sessions', label: 'Sessions', numeric: true },
            { key: 'users', label: 'Users', numeric: true },
            { key: 'views', label: 'Views', numeric: true },
            { key: 'engagement_rate', label: 'Engagement', numeric: true, render: (v) => (v == null ? '—' : `${(Number(v) * 100).toFixed(1)}%`) },
          ]}
          rows={data?.channels || []}
          emptyLabel="No channel data returned."
        />
      </Panel>

      {(data?.countries || []).length > 0 && (
        <Panel title="Top countries">
          <DataTable
            columns={[
              { key: 'dimension_value', label: 'Country', className: 'font-medium' },
              { key: 'sessions', label: 'Sessions', numeric: true },
              { key: 'users', label: 'Users', numeric: true },
            ]}
            rows={data.countries}
            emptyLabel="No country data returned."
          />
        </Panel>
      )}
    </div>
  );
}

function PageSpeedTab({ status }) {
  const [strategy, setStrategy] = useState('mobile');
  const [url, setUrl] = useState('');
  const [queued, setQueued] = useState(false);
  const { state, data, error, reload } = useResource(() => fetchPageSpeed({ url, strategy }), [url, strategy]);

  async function onRun() {
    setQueued(true);
    try { await runPageSpeed({ url, strategy }); }
    catch (err) { /* surfaced on the next poll */ }
  }

  if (state === 'LOADING') return <SkeletonPanel rows={5} />;
  if (state === 'UNAVAILABLE') return <UnavailableState error={error} onRetry={reload} />;
  if (state === 'ERROR') return <ErrorState error={error} onRetry={reload} />;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[1fr_160px_auto]">
        <input
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
          placeholder={status?.pagespeed?.defaultUrl || 'Site home page'}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <select className="h-10 rounded-lg border border-input bg-background px-3 text-sm" value={strategy} onChange={(e) => setStrategy(e.target.value)}>
          <option value="mobile">Mobile</option>
          <option value="desktop">Desktop</option>
        </select>
        <button onClick={onRun} className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
          Run test
        </button>
      </div>

      {queued && data?.status !== 'fresh' && (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Test queued. A PageSpeed run takes 10–30 seconds and completes in the background — reload this tab shortly.
        </div>
      )}

      {data?.status === 'never_run' && !queued && (
        <EmptyState title="No PageSpeed result yet" description="Run a test to collect the first measurement for this URL." />
      )}

      {data?.data && (
        <Panel title={`Result · ${data.status === 'stale' ? 'stale' : 'fresh'}`}>
          <p className="mb-3 text-xs text-muted-foreground">
            {data.url} · {data.strategy} · fetched {data.fetchedAt ? formatDate(data.fetchedAt, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
          </p>
          <pre className="max-h-96 overflow-auto rounded-lg bg-secondary/50 p-3 text-xs">{JSON.stringify(data.data, null, 2)}</pre>
        </Panel>
      )}
    </div>
  );
}

function NotFoundTab() {
  const [page, setPage] = useState(1);
  const { state, data, error, reload } = useResource(() => fetchNotFoundLog({ page, perPage: 25 }), [page]);

  if (state === 'LOADING') return <SkeletonPanel rows={8} />;
  if (state === 'UNAVAILABLE') return <UnavailableState error={error} onRetry={reload} />;
  if (state === 'ERROR') return <ErrorState error={error} onRetry={reload} />;

  const items = data?.items || [];
  const pages = data?.totalPages || 1;

  return (
    <div className="space-y-4">
      <Panel title={`404s · ${data?.total ?? 0} distinct URLs`}>
        <DataTable
          columns={[
            { key: 'url', label: 'URL', className: 'font-medium break-all' },
            { key: 'hits', label: 'Hits', numeric: true },
            { key: 'lastSeen', label: 'Last seen' },
          ]}
          rows={items}
          emptyLabel="No 404s logged."
        />
      </Panel>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Page {page} of {pages}</p>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm disabled:opacity-40">Previous</button>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- shared */

function Kpi({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function Panel({ title, action, children }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function DataTable({ columns, rows, emptyLabel }) {
  if (!rows || rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`px-2 py-2 font-semibold ${c.numeric ? 'text-right' : ''}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-border last:border-0">
              {columns.map((c) => (
                <td key={c.key} className={`px-2 py-2 ${c.numeric ? 'text-right tabular-nums' : ''} ${c.className || ''}`}>
                  {c.render ? c.render(row[c.key]) : (row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
