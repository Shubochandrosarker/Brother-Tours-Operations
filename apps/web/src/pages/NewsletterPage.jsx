import React, { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { ChevronLeft, ChevronRight, MailCheck, Search, Users } from 'lucide-react';
import { listSubscribers } from '@/api/inbox';
import { ApiError } from '@/api/client';
import { EmptyState, ErrorState, Skeleton, UnavailableState } from '@/components/states/StateViews';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { formatDate, formatNumber } from '@/lib/format';

export default function NewsletterPage() {
  const [filters, setFilters] = useState({ page: 1, perPage: 25, search: '', status: '' });
  const [state, setState] = useState('LOADING');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setState('LOADING'); setError(null);
    try {
      const result = await listSubscribers(filters);
      setData(result);
      setState((result?.items || []).length ? 'DATA' : 'EMPTY');
    } catch (err) {
      setError(err);
      setState(err instanceof ApiError && err.isUnavailable ? 'UNAVAILABLE' : 'ERROR');
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);
  const items = data?.items || [];
  const total = data?.total ?? items.length;
  const pages = data?.totalPages || Math.max(1, Math.ceil(total / filters.perPage));
  const activeOnPage = items.filter((item) => item.status === 'active').length;

  return <>
    <Helmet><title>Newsletter · Brother Tours Operations</title><meta name="robots" content="noindex,nofollow" /></Helmet>
    <div className="space-y-5">
      <div><h1 className="text-xl font-semibold">Newsletter</h1><p className="mt-1 text-sm text-muted-foreground">Browse the Formistic subscriber list. WordPress remains the source of truth.</p></div>
      <div className="grid gap-4 sm:grid-cols-2"><MetricCard label="Subscribers" value={formatNumber(total)} icon={Users}/><MetricCard label="Active on this page" value={formatNumber(activeOnPage)} icon={MailCheck}/></div>
      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[1fr_220px]">
        <label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><input className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm" value={filters.search} placeholder="Search subscriber email" onChange={(e)=>setFilters((f)=>({...f,search:e.target.value,page:1}))}/></label>
        <select className="h-10 rounded-lg border border-input bg-background px-3 text-sm" value={filters.status} onChange={(e)=>setFilters((f)=>({...f,status:e.target.value,page:1}))}><option value="">All statuses</option><option value="active">Active</option><option value="unsubscribed">Unsubscribed</option></select>
      </div>
      {state === 'LOADING' && <div className="space-y-2">{Array.from({length:7}).map((_,i)=><Skeleton key={i} className="h-14 rounded-lg"/>)}</div>}
      {state === 'UNAVAILABLE' && <UnavailableState error={error} onRetry={load}/>} {state === 'ERROR' && <ErrorState error={error} onRetry={load}/>} {state === 'EMPTY' && <EmptyState title="No subscribers found" description="No newsletter subscribers match the current filters."/>}
      {state === 'DATA' && <><div className="overflow-hidden rounded-xl border border-border bg-card"><div className="hidden grid-cols-[1.8fr_1fr_1fr_1fr] border-b border-border bg-secondary/30 px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground md:grid"><span>Email</span><span>Status</span><span>Source</span><span>Consent</span></div><div className="divide-y divide-border">{items.map((item)=><div key={item.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1.8fr_1fr_1fr_1fr] md:items-center"><div className="min-w-0"><p className="truncate font-medium">{item.email}</p><p className="text-xs text-muted-foreground md:hidden">{item.source || 'Unknown source'}</p></div><span><span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${item.status==='active'?'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400':'bg-secondary text-muted-foreground'}`}>{item.status || 'unknown'}</span></span><span className="hidden text-muted-foreground md:block">{item.source || '—'}</span><span className="text-xs text-muted-foreground">{formatDate(item.consentAt,{month:'short',day:'numeric',year:'numeric'}) || '—'}</span></div>)}</div></div><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{formatNumber(total)} subscribers · Page {filters.page} of {pages}</p><div className="flex gap-2"><button className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm disabled:opacity-40" disabled={filters.page<=1} onClick={()=>setFilters((f)=>({...f,page:f.page-1}))}><ChevronLeft className="h-4 w-4"/>Previous</button><button className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm disabled:opacity-40" disabled={filters.page>=pages} onClick={()=>setFilters((f)=>({...f,page:f.page+1}))}>Next<ChevronRight className="h-4 w-4"/></button></div></div></>}
    </div>
  </>;
}
