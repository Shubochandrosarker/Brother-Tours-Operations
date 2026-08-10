import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, RefreshCw, Send } from 'lucide-react';
import {
  addBookingNote, assignBookingStaff, createPaymentLink, dispatchBooking,
  fetchInquiry, fetchInquiryActions, setBookingWorkflow, triggerBookingLifecycle,
} from '@/api/inquiries';
import { listTeam } from '@/api/team';
import { ApiError } from '@/api/client';
import { EmptyState, ErrorState, SkeletonPanel, UnavailableState } from '@/components/states/StateViews';
import InquiryStatusBadge from '@/components/inquiries/InquiryStatusBadge';
import { formatCurrency, formatDate } from '@/lib/format';

export default function BookingDetailPage() {
  const { id } = useParams();
  const [state,setState]=useState('LOADING'); const [record,setRecord]=useState(null); const [actions,setActions]=useState(null); const [team,setTeam]=useState([]); const [error,setError]=useState(null);
  const [working,setWorking]=useState(false); const [notice,setNotice]=useState(''); const [actionError,setActionError]=useState('');
  const [note,setNote]=useState(''); const [gateway,setGateway]=useState(''); const [paymentType,setPaymentType]=useState('deposit'); const [dispatchEvent,setDispatchEvent]=useState('inquiry.created');

  const load=useCallback(async()=>{ setState('LOADING'); setError(null); try { const [detail,allowed,staff]=await Promise.all([fetchInquiry(id),fetchInquiryActions(id),listTeam({perPage:100}).catch(()=>({items:[]}))]); setRecord(detail); setActions(allowed); setTeam(staff?.items||[]); setState(detail?'DATA':'EMPTY'); } catch(err){ setError(err); setState(err instanceof ApiError && err.isUnavailable?'UNAVAILABLE':'ERROR'); } },[id]);
  useEffect(()=>{load();},[load]);

  const run=async(fn,success)=>{ setWorking(true); setActionError(''); setNotice(''); try { const result=await fn(); setNotice(success); await load(); return result; } catch(err){ setActionError(err?.message||'Action failed.'); return null; } finally { setWorking(false); } };

  if(state==='LOADING') return <SkeletonPanel rows={10}/>;
  if(state==='UNAVAILABLE') return <UnavailableState error={error} onRetry={load}/>;
  if(state==='ERROR') return <ErrorState error={error} onRetry={load}/>;
  if(state==='EMPTY'||!record) return <EmptyState title="Booking not found" description="The requested inquiry or booking could not be found."/>;

  const lifecycle=actions?.lifecycle || record.allowedActions || {};
  const workflows=actions?.workflow || {new:'New',reviewed:'Reviewed',sent:'Sent',closed:'Closed'};
  const gateways=(actions?.paymentGateways||[]).filter(g=>g.configured);
  const transactions=record.transactions||[]; const activity=record.activity||[]; const connections=record.connections||[];

  return <>
    <Helmet><title>{record.reference} · Brother Tours Operations</title><meta name="robots" content="noindex,nofollow"/></Helmet>
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><Link to="/inquiries" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4"/>Back to inquiries</Link><div className="mt-3 flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold">{record.reference}</h1><InquiryStatusBadge status={record.status}/><InquiryStatusBadge status={record.workflow}/></div><p className="mt-1 text-sm text-muted-foreground">{record.customer?.name || 'Traveler'} · {record.tour || 'No tour selected'}</p></div>
        <button onClick={load} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm"><RefreshCw className="h-4 w-4"/>Refresh</button>
      </div>
      {notice && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">{notice}</div>}
      {actionError && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{actionError}</div>}

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Panel title="Overview"><InfoGrid items={[
            ['Reference',record.reference],['Inquiry type',label(record.type)],['Lifecycle',label(record.status)],['Workflow',label(record.workflow)],['Assigned staff',record.assignedName||'Unassigned'],['Created',formatDate(record.createdAt)],['Updated',formatDate(record.updatedAt)],['Source URL',record.sourceUrl||'—']
          ]}/></Panel>
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Traveler"><InfoGrid items={[["Name",record.customer?.name],["Email",record.customer?.email],["Phone",record.customer?.phone],["Country",record.customer?.country],["Adults",record.party?.adults],["Children",record.party?.children]]}/></Panel>
            <Panel title="Trip"><InfoGrid items={[["Tour",record.tour],["Departure",record.departure?.title],["Departure date",record.departure?.date],["Hotel preference",record.hotelPreference],["Currency",record.currency],["Quoted price",money(record.priceAmount,record.currency)],["Deposit",money(record.depositAmount,record.currency)],["Balance",money(record.balanceAmount,record.currency)]]}/>{record.specialRequests&&<div className="mt-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Special requests</p><p className="mt-1 whitespace-pre-line text-sm">{record.specialRequests}</p></div>}</Panel>
          </div>
          <Panel title="Payments">{transactions.length===0?<p className="text-sm text-muted-foreground">No transactions recorded.</p>:<div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th className="pb-2">Gateway</th><th className="pb-2">Type</th><th className="pb-2">Amount</th><th className="pb-2">Status</th><th className="pb-2">Date</th></tr></thead><tbody className="divide-y divide-border">{transactions.map(t=><tr key={t.id}><td className="py-2.5">{t.gateway}</td><td>{label(t.type)}</td><td>{money(t.amount,t.currency)}</td><td><InquiryStatusBadge status={t.status}/></td><td>{formatDate(t.createdAt,{month:'short',day:'numeric',year:'numeric'})}</td></tr>)}</tbody></table></div>}</Panel>
          <Panel title="Activity">{activity.length===0?<p className="text-sm text-muted-foreground">No activity logged.</p>:<div className="space-y-0">{activity.map(a=><div key={a.id} className="border-b border-border py-3 last:border-0"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">{label(a.action)}</p><span className="text-xs text-muted-foreground">{formatDate(a.createdAt,{month:'short',day:'numeric',year:'numeric'})}</span></div><p className="mt-1 text-xs text-muted-foreground">Actor: {a.actor || 'system'}{typeof a.detail==='string'&&a.detail?` · ${a.detail}`:''}</p>{a.detail&&typeof a.detail==='object'&&<pre className="mt-2 overflow-x-auto rounded-lg bg-secondary/40 p-2 text-[11px]">{JSON.stringify(a.detail,null,2)}</pre>}</div>)}</div>}</Panel>
          <Panel title="Connections">{connections.length===0?<p className="text-sm text-muted-foreground">No connection deliveries attached to this record.</p>:<div className="space-y-3">{connections.map(c=><div key={c.id} className="rounded-lg border border-border p-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">{c.event}</p><InquiryStatusBadge status={c.statusCode>=200&&c.statusCode<300?'sent':'failed'}/></div><p className="mt-1 text-xs text-muted-foreground">HTTP {c.statusCode} · {c.attempts} attempt(s) · {formatDate(c.createdAt)}</p>{c.response&&<p className="mt-2 text-xs text-muted-foreground">{c.response}</p>}</div>)}</div>}</Panel>
        </div>

        <aside className="space-y-5">
          <Panel title="Assignment & workflow">
            <label className="grid gap-1.5 text-xs text-muted-foreground">Assigned team member<select className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground" value={String(record.assignedTo||0)} disabled={working} onChange={(e)=>run(()=>assignBookingStaff(id,e.target.value),'Assignment updated.')}><option value="0">Unassigned</option>{team.map(u=><option key={u.id} value={u.id}>{u.displayName}</option>)}</select></label>
            <label className="mt-4 grid gap-1.5 text-xs text-muted-foreground">Workflow<select className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground" value={record.workflow||'new'} disabled={working} onChange={(e)=>run(()=>setBookingWorkflow(id,e.target.value),'Workflow updated.')} >{Object.entries(workflows).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
          </Panel>
          <Panel title="Allowed lifecycle actions">{Object.keys(lifecycle).length===0?<p className="text-sm text-muted-foreground">No lifecycle transitions are currently available.</p>:<div className="grid gap-2">{Object.entries(lifecycle).map(([action,actionLabel])=><button key={action} disabled={working} onClick={()=>run(()=>triggerBookingLifecycle(id,action),`${String(actionLabel||action)} completed.`)} className="h-9 rounded-lg border border-border bg-background px-3 text-left text-sm font-medium hover:bg-secondary disabled:opacity-50">{String(actionLabel||label(action))}</button>)}</div>}</Panel>
          <Panel title="Internal note"><textarea className="min-h-24 w-full rounded-lg border border-input bg-background p-3 text-sm" placeholder="Add an internal note" value={note} onChange={(e)=>setNote(e.target.value)}/><button disabled={working||!note.trim()} onClick={async()=>{const r=await run(()=>addBookingNote(id,note),'Internal note saved.');if(r)setNote('');}} className="mt-2 h-9 w-full rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">Save note</button></Panel>
          <Panel title="Payment link">{gateways.length===0?<p className="text-sm text-muted-foreground">No configured payment gateways are available.</p>:<><select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={gateway} onChange={(e)=>setGateway(e.target.value)}><option value="">Select gateway</option>{gateways.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select><select className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={paymentType} onChange={(e)=>setPaymentType(e.target.value)}><option value="deposit">Deposit</option><option value="balance">Balance</option></select><button disabled={working||!gateway} onClick={async()=>{const result=await run(()=>createPaymentLink(id,gateway,paymentType),'Payment link created.');if(result?.redirectUrl) window.open(result.redirectUrl,'_blank','noopener,noreferrer');}} className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border text-sm font-medium disabled:opacity-50">Create payment link<ExternalLink className="h-4 w-4"/></button></>}</Panel>
          <Panel title="Dispatch connection"><select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={dispatchEvent} onChange={(e)=>setDispatchEvent(e.target.value)}>{['inquiry.created','booking.deposit_link','booking.deposit_paid','booking.confirmed','booking.balance_link','booking.balance_paid'].map(v=><option key={v} value={v}>{v}</option>)}</select><button disabled={working} onClick={()=>run(()=>dispatchBooking(id,dispatchEvent),'Connection dispatched.')} className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border text-sm font-medium"><Send className="h-4 w-4"/>Dispatch</button></Panel>
        </aside>
      </div>
    </div>
  </>;
}

function Panel({title,children}){return <section className="rounded-xl border border-border bg-card p-5"><h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">{title}</h2>{children}</section>}
function InfoGrid({items}){return <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">{items.filter(([,v])=>v!==undefined&&v!==null&&v!=='').map(([k,v])=><div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-0.5 break-words text-sm font-medium">{String(v)}</dd></div>)}</dl>}
function label(v){return String(v||'').replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase())}
function money(v,c){if(v===undefined||v===null||v==='')return '—';const n=Number(v);return Number.isFinite(n)?formatCurrency(n,{currency:c||'USD'}):`${v} ${c||''}`.trim()}
