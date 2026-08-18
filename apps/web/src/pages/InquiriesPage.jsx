import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { fetchInquiries } from '@/api/inquiries';
import { ApiError } from '@/api/client';
import { EmptyState, ErrorState, Skeleton, UnavailableState } from '@/components/states/StateViews';
import InquiryStatusBadge from '@/components/inquiries/InquiryStatusBadge';
import { formatDate } from '@/lib/format';

const PER_PAGE = 25;
const lifecycleOptions = ['inquiry','quoted','deposit_link_sent','deposit_paid','confirmed','balance_due','paid_in_full','completed','cancelled','expired','refunded'];
const workflowOptions = ['new','reviewed','sent','closed'];
const orderOptions = [
  ['id','Newest'], ['reference','Reference'], ['customer_name','Customer'], ['created_at','Created'], ['updated_at','Updated'], ['status','Lifecycle'], ['portal_status','Workflow']
];

function readFilters(sp) {
  return {
    search: sp.get('search') || '', status: sp.get('status') || '', workflow: sp.get('workflow') || '', type: sp.get('type') || '',
    assignedTo: sp.get('assigned') || '', tourId: sp.get('tour') || '', from: sp.get('from') || '', to: sp.get('to') || '',
    orderby: sp.get('orderby') || 'id', order: (sp.get('order') || 'DESC').toUpperCase(), page: Math.max(1, Number(sp.get('page') || 1)), perPage: PER_PAGE,
  };
}
function writeFilters(f) {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k,v]) => { if (v && !['perPage'].includes(k) && !(k==='page' && Number(v)===1) && !(k==='orderby' && v==='id') && !(k==='order' && v==='DESC')) p.set(k==='assignedTo'?'assigned':k==='tourId'?'tour':k, String(v)); });
  return p;
}

export default function InquiriesPage() {
  const [sp,setSp] = useSearchParams();
  const [filters,setFilters] = useState(()=>readFilters(sp));
  const [state,setState] = useState('LOADING');
  const [result,setResult] = useState(null);
  const [error,setError] = useState(null);
  const abort = useRef(null);
  const navigate = useNavigate();

  useEffect(()=>{ setSp(writeFilters(filters),{replace:true}); },[filters,setSp]);
  const load = useCallback(async()=>{
    abort.current?.abort(); const ctrl=new AbortController(); abort.current=ctrl; setState('LOADING'); setError(null);
    try { const res=await fetchInquiries(filters,ctrl.signal); if(ctrl.signal.aborted)return; setResult(res); setState((res?.items||[]).length?'DATA':'EMPTY'); }
    catch(err){ if(err?.name==='AbortError')return; setError(err); setState(err instanceof ApiError && err.isUnavailable?'UNAVAILABLE':'ERROR'); }
  },[filters]);
  useEffect(()=>{ load(); return()=>abort.current?.abort(); },[load]);

  const items=result?.items||[]; const total=result?.total||0; const totalPages=result?.totalPages||1;
  const update=(key,value)=>setFilters((f)=>({...f,[key]:value,page:1}));

  return <>
    <Helmet><title>Inquiries & Bookings · Brother Tours Operations</title><meta name="robots" content="noindex,nofollow" /></Helmet>
    <div className="space-y-5">
      <div><h1 className="text-xl font-semibold">Inquiries & Bookings</h1><p className="mt-1 text-sm text-muted-foreground">Manage Tour Manager records, assignment, workflow and lifecycle from one queue.</p></div>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="relative xl:col-span-2"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><input className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/20" placeholder="Reference, customer, email or phone" value={filters.search} onChange={(e)=>update('search',e.target.value)}/></label>
          <Select label="Workflow" value={filters.workflow} onChange={(v)=>update('workflow',v)} options={workflowOptions}/>
          <Select label="Lifecycle" value={filters.status} onChange={(v)=>update('status',v)} options={lifecycleOptions}/>
          <input className="h-10 rounded-lg border border-input bg-background px-3 text-sm" placeholder="Inquiry type" value={filters.type} onChange={(e)=>update('type',e.target.value)}/>
          <input className="h-10 rounded-lg border border-input bg-background px-3 text-sm" type="number" min="0" placeholder="Assigned user ID" value={filters.assignedTo} onChange={(e)=>update('assignedTo',e.target.value)}/>
          <input className="h-10 rounded-lg border border-input bg-background px-3 text-sm" type="number" min="0" placeholder="Tour ID" value={filters.tourId} onChange={(e)=>update('tourId',e.target.value)}/>
          <div className="grid grid-cols-2 gap-2"><input className="h-10 rounded-lg border border-input bg-background px-2 text-sm" type="date" value={filters.from} onChange={(e)=>update('from',e.target.value)}/><input className="h-10 rounded-lg border border-input bg-background px-2 text-sm" type="date" value={filters.to} onChange={(e)=>update('to',e.target.value)}/></div>
          <select className="h-10 rounded-lg border border-input bg-background px-3 text-sm" value={filters.orderby} onChange={(e)=>update('orderby',e.target.value)}>{orderOptions.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
          <select className="h-10 rounded-lg border border-input bg-background px-3 text-sm" value={filters.order} onChange={(e)=>update('order',e.target.value)}><option value="DESC">Descending</option><option value="ASC">Ascending</option></select>
        </div>
      </div>

      {state==='LOADING' && <div className="space-y-2">{Array.from({length:8}).map((_,i)=><Skeleton key={i} className="h-14 w-full rounded-lg"/>)}</div>}
      {state==='UNAVAILABLE' && <UnavailableState error={error} onRetry={load}/>} {state==='ERROR' && <ErrorState error={error} onRetry={load}/>} {state==='EMPTY' && <EmptyState title="No inquiries found" description="No records match the current filters."/>}
      {state==='DATA' && <>
        <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block">
          <table className="w-full min-w-[950px] text-sm"><thead><tr className="border-b border-border bg-secondary/40 text-left text-xs text-muted-foreground"><th className="px-4 py-3">Reference</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Tour</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Lifecycle</th><th className="px-3 py-3">Workflow</th><th className="px-3 py-3">Assigned</th><th className="px-3 py-3">Created</th></tr></thead>
          <tbody className="divide-y divide-border">{items.map((item)=><tr key={item.id} onClick={()=>navigate(`/inquiries/${item.id}`)} className="cursor-pointer hover:bg-secondary/30"><td className="px-4 py-3 font-mono text-xs">{item.reference}</td><td className="px-3 py-3"><p className="font-medium">{item.customer?.name||'—'}</p><p className="text-xs text-muted-foreground">{item.customer?.email||''}</p></td><td className="px-3 py-3">{item.tour||'—'}</td><td className="px-3 py-3">{labelize(item.type)}</td><td className="px-3 py-3"><InquiryStatusBadge status={item.status}/></td><td className="px-3 py-3"><InquiryStatusBadge status={item.workflow}/></td><td className="px-3 py-3">{item.assignedName||'Unassigned'}</td><td className="px-3 py-3 text-muted-foreground">{formatDate(item.createdAt,{month:'short',day:'numeric',year:'numeric'})}</td></tr>)}</tbody></table>
        </div>
        <div className="space-y-3 md:hidden">{items.map((item)=><button key={item.id} onClick={()=>navigate(`/inquiries/${item.id}`)} className="w-full rounded-xl border border-border bg-card p-4 text-left"><div className="flex items-start justify-between gap-2"><div><p className="font-mono text-xs text-muted-foreground">{item.reference}</p><p className="mt-1 font-semibold">{item.customer?.name||'Unknown traveler'}</p></div><InquiryStatusBadge status={item.workflow}/></div><p className="mt-2 text-sm text-muted-foreground">{item.tour||'No tour selected'} · {labelize(item.type)}</p><div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span>{item.assignedName||'Unassigned'}</span><span>{formatDate(item.createdAt,{month:'short',day:'numeric'})}</span></div></button>)}</div>
        <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{total} records · Page {filters.page} of {totalPages}</p><div className="flex gap-2"><button disabled={filters.page<=1} onClick={()=>setFilters(f=>({...f,page:f.page-1}))} className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm disabled:opacity-40"><ChevronLeft className="h-4 w-4"/>Previous</button><button disabled={filters.page>=totalPages} onClick={()=>setFilters(f=>({...f,page:f.page+1}))} className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm disabled:opacity-40">Next<ChevronRight className="h-4 w-4"/></button></div></div>
      </>}
    </div>
  </>;
}

function Select({label,value,onChange,options}) { return <label className="grid gap-1 text-xs text-muted-foreground"><span>{label}</span><select className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground" value={value} onChange={(e)=>onChange(e.target.value)}><option value="">All</option>{options.map(v=><option key={v} value={v}>{labelize(v)}</option>)}</select></label>; }
function labelize(value){ return String(value||'').replace(/_/g,' ').replace(/\b\w/g,(m)=>m.toUpperCase()); }
