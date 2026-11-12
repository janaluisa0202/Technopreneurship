import { useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { Chips, ConfirmDialog, EmptyState, Field, Modal, PageHeader, Pill, useNow, useToast } from '../components/ui';
import { adminStore, useAdminState } from '../services/store';
import { timeAgo } from '../lib/format';
import { channelLabels } from '../lib/labels';
import type { Announcement, AnnouncementChannel, AnnouncementDraft, AnnouncementStatus } from '../types';

const tone = { published: 'green', draft: 'yellow', archived: 'neutral' } as const;

export function Announcements() {
  const { announcements } = useAdminState();
  const now = useNow();
  const toast = useToast();
  const [tab, setTab] = useState<'all' | AnnouncementStatus>('all');
  const [editing, setEditing] = useState<{ item?: Announcement } | null>(null);
  const [deleting, setDeleting] = useState<Announcement | null>(null);
  const rows = announcements.filter(a => tab === 'all' || a.status === tab).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const count = (s: AnnouncementStatus) => announcements.filter(a => a.status === s).length;

  return (
    <>
      <PageHeader title="Announcements" subtitle="Broadcast-style updates for Para Alerts, RoadWatch and promo notices."
        actions={<button className="btn primary" type="button" onClick={() => setEditing({})}><Icon name="plus" size={18} />New announcement</button>} />
      <div className="toolbar"><Chips label="Filter announcements" value={tab} onChange={setTab} options={[
        { value: 'all', label: 'All', count: announcements.length }, { value: 'published', label: 'Published', count: count('published') },
        { value: 'draft', label: 'Drafts', count: count('draft') }, { value: 'archived', label: 'Archived', count: count('archived') },
      ]} /></div>
      {rows.length === 0 ? <div className="panel"><EmptyState icon="announce" title="No announcements here" text="Create one to alert commuters." /></div> : (
        <ul className="card-list">
          {rows.map(a => (
            <li key={a.id} className="incident-card">
              <div className="incident-top"><div className="incident-tags"><Pill tone={tone[a.status]}>{a.status}</Pill><Pill tone="blue">{channelLabels[a.channel]}</Pill></div><small>Updated {timeAgo(a.updatedAt, now)} · {a.createdBy}</small></div>
              <h2>{a.title}</h2><p>{a.body}</p>
              <div className="card-actions">
                {a.status !== 'published' && <button type="button" className="btn small success" onClick={() => { adminStore.setAnnouncementStatus(a.id, 'published'); toast('Announcement published.'); }}><Icon name="send" size={16} />Publish</button>}
                {a.status === 'published' && <button type="button" className="btn small ghost" onClick={() => { adminStore.setAnnouncementStatus(a.id, 'archived'); toast('Announcement archived.'); }}>Archive</button>}
                <button type="button" className="btn small ghost" onClick={() => setEditing({ item: a })}><Icon name="edit" size={16} />Edit</button>
                <button type="button" className="btn small ghost danger-text" onClick={() => setDeleting(a)}><Icon name="trash" size={16} />Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && <AnnouncementForm item={editing.item} onClose={() => setEditing(null)} />}
      {deleting && <ConfirmDialog danger title="Delete announcement?" message={<>“{deleting.title}” will be removed permanently.</>} confirmLabel="Delete" onCancel={() => setDeleting(null)} onConfirm={() => { adminStore.deleteAnnouncement(deleting.id); setDeleting(null); toast('Announcement deleted.'); }} />}
    </>
  );
}

function AnnouncementForm({ item, onClose }: { item?: Announcement; onClose: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<AnnouncementDraft>({ title: item?.title ?? '', body: item?.body ?? '', channel: item?.channel ?? 'general', status: item?.status ?? 'draft' });
  const [errors, setErrors] = useState<{ title?: string; body?: string }>({});
  function submit(event: FormEvent) {
    event.preventDefault();
    const e: typeof errors = {};
    if (!d.title.trim()) e.title = 'Add a headline.'; else if (d.title.length > 100) e.title = 'Keep the headline to 100 characters.';
    if (!d.body.trim()) e.body = 'Write the announcement.'; else if (d.body.length > 600) e.body = 'Keep the text to 600 characters.';
    setErrors(e); if (Object.keys(e).length) return;
    adminStore.saveAnnouncement({ ...d, title: d.title.trim(), body: d.body.trim() }, item?.id);
    toast(d.status === 'published' ? 'Announcement published.' : 'Announcement saved.'); onClose();
  }
  return (
    <Modal title={item ? 'Edit announcement' : 'New announcement'} onClose={onClose} footer={<><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button type="submit" form="ann-form" className="btn primary">{d.status === 'published' ? 'Save & publish' : 'Save'}</button></>}>
      <form id="ann-form" onSubmit={submit} noValidate className="form-stack">
        <Field label="Headline" htmlFor="ann-title" error={errors.title}><input id="ann-title" data-autofocus value={d.title} onChange={e => setD({ ...d, title: e.target.value })} aria-invalid={!!errors.title} /></Field>
        <Field label="Text" htmlFor="ann-body" error={errors.body} hint={`${d.body.length}/600`}><textarea id="ann-body" rows={4} value={d.body} onChange={e => setD({ ...d, body: e.target.value })} aria-invalid={!!errors.body} /></Field>
        <div className="form-grid">
          <Field label="Shown in" htmlFor="ann-channel"><select id="ann-channel" value={d.channel} onChange={e => setD({ ...d, channel: e.target.value as AnnouncementChannel })}>{Object.entries(channelLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <Field label="Status" htmlFor="ann-status"><select id="ann-status" value={d.status} onChange={e => setD({ ...d, status: e.target.value as AnnouncementStatus })}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></Field>
        </div>
      </form>
    </Modal>
  );
}
