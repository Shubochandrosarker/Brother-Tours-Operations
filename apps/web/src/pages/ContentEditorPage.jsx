import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Lock, Save } from 'lucide-react';
import { createContent, getContent, listTerms, updateContent } from '@/api/content';
import { fetchSiteUsers } from '@/api/site';
import { ApiError } from '@/api/client';
import { ErrorState, SkeletonPanel, UnavailableState } from '@/components/states/StateViews';
import { formatDate } from '@/lib/format';

const SEO_TITLE_LIMIT = 60;
const SEO_DESCRIPTION_LIMIT = 155;

const EMPTY = {
  title: '', slug: '', content: '', excerpt: '', status: 'draft',
  bt_seo_title: '', bt_seo_description: '', categories: [], tags: [], author: '',
};

export default function ContentEditorPage({ mode }) {
  const { id } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const isCreate = mode === 'create';
  const type = search.get('type') || 'post';

  const [state, setState] = useState(isCreate ? 'DATA' : 'LOADING');
  const [error, setError] = useState(null);
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [authors, setAuthors] = useState([]);
  const pristine = useRef(EMPTY);

  const load = useCallback(async () => {
    if (isCreate) return;
    setState('LOADING');
    setError(null);
    try {
      const payload = await getContent(id);
      setRecord(payload);
      const next = {
        title: payload.title || '',
        slug: payload.slug || '',
        content: payload.content || '',
        excerpt: payload.excerpt || '',
        status: payload.status === 'trash' ? 'draft' : (payload.status || 'draft'),
        bt_seo_title: payload.seo?.title || '',
        bt_seo_description: payload.seo?.description || '',
        categories: (payload.terms?.category || []).map((t) => t.id),
        tags: (payload.terms?.post_tag || []).map((t) => t.id),
        author: payload.authorId || '',
      };
      setForm(next);
      pristine.current = next;
      setState('DATA');
    } catch (err) {
      setError(err);
      setState(err instanceof ApiError && err.isUnavailable ? 'UNAVAILABLE' : 'ERROR');
    }
  }, [id, isCreate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const controller = new AbortController();
    listTerms('category', '', controller.signal).then((p) => setCategories(p?.items || [])).catch(() => setCategories([]));
    fetchSiteUsers(controller.signal).then((p) => setAuthors(p?.items || [])).catch(() => setAuthors([]));
    return () => controller.abort();
  }, []);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(pristine.current), [form]);

  // Unsaved-changes guard. Two administrators share this site and there is no
  // locking, so losing an edit to a stray back-button is a real risk.
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const readOnlyBody = Boolean(record?.readOnlyBody);

  async function onSave(nextStatus) {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        title: form.title,
        slug: form.slug,
        excerpt: form.excerpt,
        status: nextStatus || form.status,
        bt_seo_title: form.bt_seo_title,
        bt_seo_description: form.bt_seo_description,
      };
      // Never send `content` for a builder record. The server rejects it with
      // 409 anyway; not sending it means a metadata-only save still succeeds.
      if (!readOnlyBody) payload.content = form.content;
      if (form.categories.length) payload.categories = form.categories;
      if (form.tags.length) payload.tags = form.tags;
      if (form.author) payload.author = Number(form.author);

      let saved;
      if (isCreate) {
        saved = await createContent({ ...payload, type });
        navigate(`/content/${saved.id}`, { replace: true });
      } else {
        // Optimistic concurrency — the server 409s if it changed underneath us.
        saved = await updateContent(id, { ...payload, modifiedGmt: record?.modifiedGmt });
        setRecord(saved);
        pristine.current = { ...form, status: saved.status };
        setForm((f) => ({ ...f, status: saved.status }));
      }
    } catch (err) {
      setSaveError(err);
    } finally {
      setSaving(false);
    }
  }

  if (state === 'LOADING') return <SkeletonPanel rows={10} />;
  if (state === 'UNAVAILABLE') return <UnavailableState error={error} onRetry={load} />;
  if (state === 'ERROR') return <ErrorState error={error} onRetry={load} />;

  return (
    <>
      <Helmet><title>{isCreate ? 'New content' : form.title || 'Edit content'} · Brother Tours Operations</title><meta name="robots" content="noindex,nofollow" /></Helmet>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <button onClick={() => navigate('/content')} className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-xl font-semibold">{isCreate ? `New ${type.replace('wpistic_', '')}` : 'Edit content'}</h1>
              {record && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Last updated {formatDate(record.modifiedGmt, { month: 'short', day: 'numeric', year: 'numeric' })}
                  {record.authorName ? ` · ${record.authorName}` : ''}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {record?.editLink && (
              <a href={record.editLink} target="_blank" rel="noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-secondary">
                <ExternalLink className="h-4 w-4" />Open in WordPress
              </a>
            )}
            <button onClick={() => onSave()} disabled={saving || !dirty}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium disabled:opacity-40 hover:bg-secondary">
              <Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save'}
            </button>
            {record?.canPublish !== false && form.status !== 'publish' && (
              <button onClick={() => onSave('publish')} disabled={saving}
                className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-40">
                Publish
              </button>
            )}
          </div>
        </div>

        {saveError && <ErrorState error={saveError} title="The save did not complete" onRetry={() => setSaveError(null)} />}

        {readOnlyBody && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="text-sm">
              <p className="font-semibold text-foreground">
                The body of this record is read-only here
              </p>
              <p className="mt-1 leading-relaxed text-muted-foreground">
                It carries {record?.hasElementorData ? 'Elementor' : 'Gutenberg block'} content. Editing that through a
                plain text field would destroy the layout, so this editor will not touch it — the server refuses the
                write too. Title, slug, excerpt, status and the SEO fields all still save normally. Use
                “Open in WordPress” for the body.
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <Field label="Title">
              <input className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </Field>
            <Field label="Slug" hint="Leave blank to generate from the title.">
              <input className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
            </Field>
            <Field label="Content">
              <textarea
                rows={16}
                disabled={readOnlyBody}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm disabled:cursor-not-allowed disabled:opacity-60"
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              />
            </Field>
            <Field label="Excerpt">
              <textarea rows={3} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                value={form.excerpt} onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))} />
            </Field>
          </div>

          <div className="space-y-4">
            <Panel title="Publish">
              <Field label="Status">
                <select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="draft">Draft</option>
                  <option value="pending">Pending review</option>
                  <option value="publish">Published</option>
                  <option value="private">Private</option>
                </select>
              </Field>
              {authors.length > 0 && (
                <Field label="Author">
                  <select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    value={form.author} onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}>
                    <option value="">Unchanged</option>
                    {authors.map((a) => <option key={a.id} value={a.id}>{a.displayName}</option>)}
                  </select>
                </Field>
              )}
            </Panel>

            <Panel title="SEO">
              <Field label="SEO title" hint={`${form.bt_seo_title.length} / ${SEO_TITLE_LIMIT}`} over={form.bt_seo_title.length > SEO_TITLE_LIMIT}>
                <input className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  value={form.bt_seo_title} onChange={(e) => setForm((f) => ({ ...f, bt_seo_title: e.target.value }))} />
              </Field>
              <Field label="Meta description" hint={`${form.bt_seo_description.length} / ${SEO_DESCRIPTION_LIMIT}`} over={form.bt_seo_description.length > SEO_DESCRIPTION_LIMIT}>
                <textarea rows={3} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  value={form.bt_seo_description} onChange={(e) => setForm((f) => ({ ...f, bt_seo_description: e.target.value }))} />
              </Field>
              {record?.seoistic && Object.keys(record.seoistic).length > 0 && (
                <div className="rounded-lg border border-border bg-secondary/40 p-3 text-xs">
                  <p className="font-semibold text-foreground">SEOISTIC audit</p>
                  <p className="mt-1 text-muted-foreground">
                    Score {record.seoistic.seoistic_score ?? '—'}
                    {record.seoistic.seoistic_last_audit ? ` · ${record.seoistic.seoistic_last_audit}` : ''}
                  </p>
                  {/* Read-only by design: SEOISTIC owns these keys and the API
                      has no write path for them. */}
                  <p className="mt-1 text-muted-foreground">Generated by SEOISTIC — read-only here.</p>
                </div>
              )}
            </Panel>

            {categories.length > 0 && type === 'post' && (
              <Panel title="Categories">
                <div className="max-h-56 space-y-1.5 overflow-y-auto">
                  {categories.map((term) => (
                    <label key={term.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.categories.includes(term.id)}
                        onChange={(e) => setForm((f) => ({
                          ...f,
                          categories: e.target.checked ? [...f.categories, term.id] : f.categories.filter((c) => c !== term.id),
                        }))}
                      />
                      <span>{term.name}</span>
                      <span className="text-xs text-muted-foreground">({term.count})</span>
                    </label>
                  ))}
                </div>
              </Panel>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, hint, over, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {hint && <span className={`text-xs ${over ? 'text-destructive' : 'text-muted-foreground'}`}>{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Panel({ title, children }) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}
