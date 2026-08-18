import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarRange, CheckCircle2, Clock3, Inbox, MessageSquare, RefreshCw, Ticket, Unplug } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fetchDashboard } from '@/api/dashboard';
import { ApiError } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { MetricCard, MetricCardSkeleton } from '@/components/dashboard/MetricCard';
import { ErrorState, UnavailableState } from '@/components/states/StateViews';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { formatDate, formatNumber } from '@/lib/format';

function Panel({ title, action, children, className = '' }) {
  return <section className={`rounded-xl border border-border bg-card p-5 ${className}`}>
    <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">{title}</h2>{action}</div>
    {children}
  </section>;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [state, setState] = useState('LOADING');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setState('LOADING'); setError(null);
    try {
      const result = await fetchDashboard();
      setData(result); setState('DATA');
    } catch (err) {
      setError(err); setState(err instanceof ApiError && err.isUnavailable ? 'UNAVAILABLE' : 'ERROR');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const attention = useMemo(() => {
    if (!data) return [];
    const out = [];
    if ((data.bookings?.unassigned || 0) > 0) out.push({ label: `${data.bookings.unassigned} inquiries need assignment`, description: 'Open inquiries are not assigned to a team member.', tone: 'warning', to: '/inquiries?workflow=new' });
    if ((data.forms?.overdue24h || 0) > 0) out.push({ label: `${data.forms.overdue24h} form submissions are over 24 hours old`, description: 'Review customer messages that may be waiting for a response.', tone: 'warning', to: '/inbox' });
    if ((data.departures?.limited || 0) > 0) out.push({ label: `${data.departures.limited} departures have limited availability`, description: 'Review capacity and customer communications.', tone: 'info', to: '/departures?status=limited' });
    if ((data.integrations?.connectionFailures24h || 0) > 0) out.push({ label: `${data.integrations.connectionFailures24h} connection failures in the last 24 hours`, description: 'Inspect webhook delivery history and integration health.', tone: 'critical', to: '/connections' });
    return out;
  }, [data]);

  if (state === 'UNAVAILABLE') return <UnavailableState error={error} onRetry={load} />;
  if (state === 'ERROR') return <ErrorState error={error} onRetry={load} />;

  const b = data?.bookings || {};
  const f = data?.forms || {};
  const d = data?.departures || {};
  const recent = Array.isArray(data?.recent) ? data.recent : [];
  const series = Array.isArray(data?.series) ? data.series : [];

  return <>
    <Helmet><title>Dashboard · Brother Tours Operations</title><meta name="robots" content="noindex,nofollow" /></Helmet>
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">Command Center</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Good {greeting()}, {user?.name || 'Operator'}</h1><p className="mt-1 text-sm text-muted-foreground">{formatDate(new Date().toISOString())}</p></div>
        <button onClick={load} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-secondary"><RefreshCw className="h-4 w-4" />Refresh</button>
      </div>

      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">Business Snapshot</h2>
        {state === 'LOADING' ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({length:8}).map((_,i)=><MetricCardSkeleton key={i}/>)}</div> :
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="New inquiries today" value={formatNumber(b.today)} icon={Inbox} />
          <MetricCard label="Open lifecycle" value={formatNumber(b.openLifecycle)} icon={Ticket} />
          <MetricCard label="Confirmed" value={formatNumber(b.confirmed)} icon={CheckCircle2} />
          <MetricCard label="Unassigned" value={formatNumber(b.unassigned)} icon={MessageSquare} />
          <MetricCard label="Forms today" value={formatNumber(f.today)} icon={MessageSquare} />
          <MetricCard label="Overdue replies" value={formatNumber(f.overdue24h)} icon={Clock3} />
          <MetricCard label="Upcoming departures" value={formatNumber(d.upcoming)} icon={CalendarRange} />
          <MetricCard label="Connection failures" value={formatNumber(data?.integrations?.connectionFailures24h)} icon={Unplug} />
        </div>}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Attention Required">
          {attention.length === 0 ? <div className="flex items-center gap-2 py-2 text-sm text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" />No urgent operational issues right now.</div> :
          <div className="divide-y divide-border">{attention.map((item)=><Link key={item.label} to={item.to} className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0 hover:opacity-80"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{item.label}</p><StatusBadge tone={item.tone} label={item.tone}/></div><p className="mt-1 text-xs text-muted-foreground">{item.description}</p></div></Link>)}</div>}
        </Panel>

        <Panel title="Upcoming Operations">
          <div className="grid gap-3 sm:grid-cols-2">
            <Link to="/departures" className="rounded-lg border border-border bg-secondary/30 p-4 transition hover:bg-secondary"><p className="text-xs uppercase tracking-wide text-muted-foreground">Upcoming departures</p><p className="mt-2 text-2xl font-semibold">{formatNumber(d.upcoming)}</p></Link>
            <Link to="/departures?status=limited" className="rounded-lg border border-border bg-secondary/30 p-4 transition hover:bg-secondary"><p className="text-xs uppercase tracking-wide text-muted-foreground">Limited availability</p><p className="mt-2 text-2xl font-semibold">{formatNumber(d.limited)}</p></Link>
          </div>
          <div className="mt-4 text-sm text-muted-foreground">Published content: {formatNumber(data?.content?.toursPublished)} tours · {formatNumber(data?.content?.destinationsPublished)} destinations · {formatNumber(data?.content?.experiencesPublished)} experiences</div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Panel title="Inquiry Trend" className="min-h-[300px]">
          {series.length ? <div className="h-60"><ResponsiveContainer width="100%" height="100%"><LineChart data={series}><XAxis dataKey="date" tick={{fontSize:11}} tickFormatter={(v)=>String(v).slice(5)} /><YAxis allowDecimals={false} tick={{fontSize:11}} width={28}/><Tooltip/><Line type="monotone" dataKey="inquiries" stroke="hsl(var(--primary))" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer></div> : <p className="text-sm text-muted-foreground">No inquiry trend data for the current period.</p>}
        </Panel>
        <Panel title="Recent Inquiries">
          {recent.length === 0 ? <p className="text-sm text-muted-foreground">No recent inquiries.</p> : <div className="divide-y divide-border">{recent.map((item)=><Link key={item.id} to={`/inquiries/${item.id}`} className="block py-3 first:pt-0 last:pb-0 hover:opacity-80"><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-medium">{item.customerName || item.reference}</p><span className="shrink-0 text-xs text-muted-foreground">{shortDate(item.createdAt)}</span></div><p className="mt-1 text-xs text-muted-foreground">{item.reference} · {item.type || 'inquiry'} · {item.workflow || item.status}</p></Link>)}</div>}
        </Panel>
      </div>
    </div>
  </>;
}

function greeting() { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'; }
function shortDate(value) { if (!value) return ''; const d = new Date(value.replace(' ', 'T') + (value.includes('T') ? '' : 'Z')); return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined,{month:'short',day:'numeric'}); }
