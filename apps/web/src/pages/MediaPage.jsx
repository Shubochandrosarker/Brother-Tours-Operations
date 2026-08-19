import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Copy, Search, Upload, X } from 'lucide-react';
import { listMedia, updateMedia, uploadMedia } from '@/api/media';
import { ApiError } from '@/api/client';
import { EmptyState, ErrorState, Skeleton, UnavailableState } from '@/components/states/StateViews';
import { formatDate } from '@/lib/format';

export default function MediaPage() {
  const [filters, setFilters] = useState({ search: '', page: 1, perPage: 40 });
  const [state, setState] = useState('LOADING');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [progress, setProgress] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const fileInput = useRef(null);

  const load = useCallback(async () => {
    setState('LOADING');
    setError(null);
    try {
      const payload = await listMedia(filters);
      setResult(payload);
      setState((payload?.items || []).length ? 'DATA' : 'EMPTY');
    } catch (err) {
      setError(err);
      setState(err instanceof ApiError && err.isUnavailable ? 'UNAVAILABLE' : 'ERROR');
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  async function onFiles(files) {
    const file = files?.[0];
    if (!file) return;
    setUploadError(null);
    setProgress(0);
    try {
      const created = await uploadMedia(file, {}, setProgress);
      setProgress(null);
      await load();
      // Open the new item straight away: alt text is required and the moment
      // right after upload is the only time anyone reliably fills it in.
      setSelected(created);
    } catch (err) {
      setProgress(null);
      setUploadError(err);
    }
  }

  const items = result?.items || [];
  const pages = result?.totalPages || 1;
  const missingAlt = items.filter((i) => i.missingAlt).length;

  return (
    <>
      <Helmet><title>Media · Brother Tours Operations</title><meta name="robots" content="noindex,nofollow" /></Helmet>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Media Library</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {result?.total ?? 0} items{missingAlt > 0 ? ` · ${missingAlt} on this page missing alt text` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input ref={fileInput} type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => onFiles(e.target.files)} />
            <button onClick={() => fileInput.current?.click()} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">
              <Upload className="h-4 w-4" />Upload
            </button>
          </div>
        </div>

        {progress !== null && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 text-sm text-muted-foreground">Uploading… {progress}%</p>
            <div className="h-1.5 overflow-hidden rounded bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        {uploadError && <ErrorState error={uploadError} title="The upload did not complete" onRetry={() => setUploadError(null)} />}

        <label className="relative block">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <input
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm"
            placeholder="Search media"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
          />
        </label>

        {state === 'LOADING' && <div className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-6">{Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}</div>}
        {state === 'UNAVAILABLE' && <UnavailableState error={error} onRetry={load} />}
        {state === 'ERROR' && <ErrorState error={error} onRetry={load} />}
        {state === 'EMPTY' && <EmptyState title="No media found" description="Upload a file or adjust the search." />}

        {state === 'DATA' && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
              {items.map((item) => (
                <button key={item.id} onClick={() => setSelected(item)} className="group relative overflow-hidden rounded-xl border border-border bg-card text-left">
                  <div className="aspect-square bg-secondary">
                    {item.thumbnail
                      ? <img src={item.thumbnail} alt={item.alt || ''} className="h-full w-full object-cover" loading="lazy" />
                      : <div className="flex h-full items-center justify-center px-2 text-center text-xs text-muted-foreground">{item.mimeType}</div>}
                  </div>
                  {item.missingAlt && (
                    <span className="absolute left-2 top-2 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      No alt
                    </span>
                  )}
                  <p className="truncate px-2 py-1.5 text-xs text-muted-foreground">{item.title}</p>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Page {filters.page} of {pages}</p>
              <div className="flex gap-2">
                <button disabled={filters.page <= 1} onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))} className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm disabled:opacity-40">Previous</button>
                <button disabled={filters.page >= pages} onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))} className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm disabled:opacity-40">Next</button>
              </div>
            </div>
          </>
        )}
      </div>

      {selected && <MediaDetail item={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); load(); }} />}
    </>
  );
}

function MediaDetail({ item, onClose, onSaved }) {
  const [form, setForm] = useState({ title: item.title || '', alt: item.alt || '', caption: item.caption || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function onSave() {
    setSaving(true);
    setError(null);
    try { await updateMedia(item.id, form); onSaved(); }
    catch (err) { setError(err); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold">Media details</h2>
          <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {item.medium && <img src={item.medium} alt={item.alt || ''} className="mb-4 max-h-64 w-full rounded-lg object-contain" />}

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Title</span>
            <input className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-baseline justify-between">
              <span className="text-sm font-medium">Alt text</span>
              {!form.alt && <span className="text-xs text-amber-600 dark:text-amber-400">Required for accessibility and SEO</span>}
            </span>
            <input className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={form.alt} onChange={(e) => setForm((f) => ({ ...f, alt: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Caption</span>
            <input className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={form.caption} onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))} />
          </label>

          <div className="rounded-lg border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
            <p className="break-all">{item.url}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button onClick={() => navigator.clipboard?.writeText(item.url)} className="inline-flex items-center gap-1.5 text-foreground hover:text-primary">
                <Copy className="h-3.5 w-3.5" />Copy URL
              </button>
              <span>{item.width && item.height ? `${item.width}×${item.height}` : item.mimeType}</span>
              <span>{formatDate(item.uploadedAt, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error.message}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm">Cancel</button>
            <button onClick={onSave} disabled={saving} className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-40">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
