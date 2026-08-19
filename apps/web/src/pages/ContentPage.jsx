import React, { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ExternalLink, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { deleteContent, listContent, listContentTypes, restoreContent } from '@/api/content';
import { ApiError } from '@/api/client';
import { EmptyState, ErrorState, Skeleton, UnavailableState } from '@/components/states/StateViews';
import { formatDate } from '@/lib/format';

const STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'publish', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'private', label: 'Private' },
  { value: 'future', label: 'Scheduled' },
  { value: 'trash', label: 'Trash' },
];

export default function ContentPage() {
  const [types, setTypes] = useState([]);
  const [filters, setFilters] = useState({ type: 'post', status: '', search: '', page: 1, perPage: 20, orderby: 'modified', order: 'DESC' });
  const [state, setState] = useState('LOADING');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();
    listContentTypes(controller.signal)
      .then((payload) => setTypes(payload?.types || []))
      .catch(() => setTypes([]));
    return () => controller.abort();
  }, []);

  const load = useCallback(async () => {
    setState('LOADING');
    setError(null);
    try {
      const payload = await listContent(filters);
      setResult(payload);
      setState((payload?.items || []).length ? 'DATA' : 'EMPTY');
    } catch (err) {
      setError(err);
      setState(err instanceof ApiError && err.isUnavailable ? 'UNAVAILABLE' : 'ERROR');
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const items = result?.items || [];
  const pages = result?.totalPages || 1;
  const activeType = types.find((t) => t.type === filters.type);

  async function onTrash(item) {
    setBusyId(item.id);
    try { await deleteContent(item.id); await load(); }
    catch (err) { setError(err); setState('ERROR'); }
    finally { setBusyId(null); }
  }

  async function onRestore(item) {
    setBusyId(item.id);
    try { await restoreContent(item.id); await load(); }
    catch (err) { setError(err); setState('ERROR'); }
    finally { setBusyId(null); }
  }

  return (
    <>
      <Helmet><title>Content · Brother Tours Operations</title><meta name="robots" content="noindex,nofollow" /></Helmet>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Articles &amp; Pages</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage WordPress content. WordPress remains the source of truth — nothing is copied into this app.
            </p>
          </div>
          <button
            onClick={() => navigate(`/content/new?type=${filters.type}`)}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" />New {activeType?.singular?.toLowerCase() || 'item'}
          </button>
        </div>

        {types.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {types.map((type) => (
              <button
                key={type.type}
                onClick={() => setFilters((f) => ({ ...f, type: type.type, page: 1 }))}
                className={`inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-sm transition ${
                  filters.type === type.type ? 'border-primary/40 bg-secondary text-foreground' : 'border-border text-muted-foreground hover:bg-secondary/60'
                }`}
              >
                {type.label}
                <span className="rounded bg-muted px-1.5 text-xs tabular-nums">{type.counts?.publish ?? 0}</span>
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[1fr_180px_180px]">
          <label className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <input
              className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm"
              placeholder="Search content"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
            />
          </label>
          <select
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
          >
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            value={`${filters.orderby}:${filters.order}`}
            onChange={(e) => { const [orderby, order] = e.target.value.split(':'); setFilters((f) => ({ ...f, orderby, order, page: 1 })); }}
          >
            <option value="modified:DESC">Recently updated</option>
            <option value="date:DESC">Newest created</option>
            <option value="title:ASC">Title A–Z</option>
          </select>
        </div>

        {state === 'LOADING' && <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>}
        {state === 'UNAVAILABLE' && <UnavailableState error={error} onRetry={load} />}
        {state === 'ERROR' && <ErrorState error={error} onRetry={load} />}
        {state === 'EMPTY' && <EmptyState title="No content found" description="Create an item or adjust the filters." />}

        {state === 'DATA' && (
          <>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Title</th>
                    <th className="hidden px-4 py-3 font-semibold sm:table-cell">Status</th>
                    <th className="hidden px-4 py-3 font-semibold lg:table-cell">Author</th>
                    <th className="hidden px-4 py-3 font-semibold lg:table-cell">SEO</th>
                    <th className="hidden px-4 py-3 font-semibold md:table-cell">Updated</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                      <td className="px-4 py-3">
                        <button onClick={() => navigate(`/content/${item.id}`)} className="text-left font-medium text-foreground hover:text-primary">
                          {item.title || '(no title)'}
                        </button>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>/{item.slug}</span>
                          {/* Elementor and block records cannot round-trip a textarea, so
                              the editor opens read-only. Flag it in the list too. */}
                          {(item.hasElementorData || item.hasBlocks) && (
                            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-600 dark:text-amber-400">
                              {item.hasElementorData ? 'Elementor' : 'Blocks'} · read-only
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell"><StatusPill status={item.status} /></td>
                      <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{item.authorName || '—'}</td>
                      <td className="hidden px-4 py-3 lg:table-cell"><SeoCell seo={item.seo} /></td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                        {formatDate(item.modifiedGmt, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {item.viewLink && (
                            <a href={item.viewLink} target="_blank" rel="noreferrer" title="View on site"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          {item.status === 'trash' ? (
                            <button onClick={() => onRestore(item)} disabled={busyId === item.id} title="Restore"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40">
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          ) : (
                            <button onClick={() => onTrash(item)} disabled={busyId === item.id} title="Move to trash"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{result?.total ?? items.length} items · Page {filters.page} of {pages}</p>
              <div className="flex gap-2">
                <button disabled={filters.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm disabled:opacity-40">
                  <ChevronLeft className="h-4 w-4" />Previous
                </button>
                <button disabled={filters.page >= pages} onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm disabled:opacity-40">
                  Next<ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function StatusPill({ status }) {
  const tone = {
    publish: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    draft: 'bg-muted text-muted-foreground',
    pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    future: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
    trash: 'bg-destructive/10 text-destructive',
  }[status] || 'bg-muted text-muted-foreground';
  const label = status === 'publish' ? 'Published' : status === 'future' ? 'Scheduled' : status;
  return <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium capitalize ${tone}`}>{label}</span>;
}

/**
 * The SEOISTIC score is read-only audit output from another plugin. Shown so an
 * editor can act on it; never written back from here.
 */
function SeoCell({ seo }) {
  if (!seo) return <span className="text-xs text-muted-foreground">—</span>;
  const missing = [];
  if (!seo.title) missing.push('title');
  if (!seo.description) missing.push('description');
  return (
    <div className="flex items-center gap-2">
      {typeof seo.score === 'number' ? (
        <span className={`inline-flex h-6 min-w-[2rem] items-center justify-center rounded px-1.5 text-xs font-semibold tabular-nums ${
          seo.score >= 70 ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
            : seo.score >= 40 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            : 'bg-destructive/10 text-destructive'
        }`}>{seo.score}</span>
      ) : <span className="text-xs text-muted-foreground">no score</span>}
      {missing.length > 0 && <span className="text-xs text-muted-foreground">missing {missing.join(' + ')}</span>}
    </div>
  );
}
