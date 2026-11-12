import { useMemo, useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { Chips, ConfirmDialog, EmptyState, Field, Modal, PageHeader, Pill, SearchBox, useDebounced, useNow, useToast } from '../components/ui';
import { run } from '../lib/actions';
import { adminStore, useAdminState } from '../services/store';
import { fromLocalInput, fullDate, timeAgo, toLocalInput } from '../lib/format';
import { incidentCategoryLabels, severityLabels } from '../lib/labels';
import type { AdvisoryCategory, AdvisorySeverity, Incident, IncidentDraft, IncidentStatus } from '../types';

const sevTone = { low: 'blue', moderate: 'yellow', high: 'orange', critical: 'red' } as const;
const statTone = { active: 'red', scheduled: 'blue', resolved: 'green' } as const;

const blank = (): IncidentDraft => ({ title: '', description: '', category: 'traffic', severity: 'moderate', status: 'active', areaName: '', suggestedAction: '', startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 4 * 3600000).toISOString() });

export function Incidents() {
  const { incidents } = useAdminState();
  const now = useNow();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const q = useDebounced(query).trim().toLowerCase();
  const [status, setStatus] = useState<'all' | IncidentStatus>('all');
  const [severity, setSeverity] = useState<'all' | AdvisorySeverity>('all');
  const [category, setCategory] = useState<'all' | AdvisoryCategory>('all');
  const [editing, setEditing] = useState<{ incident?: Incident } | null>(null);
  const [deleting, setDeleting] = useState<Incident | null>(null);

  const rows = useMemo(() => incidents
    .filter(i => (status === 'all' || i.status === status) && (severity === 'all' || i.severity === severity) && (category === 'all' || i.category === category))
    .filter(i => !q || `${i.title} ${i.description} ${i.areaName}`.toLowerCase().includes(q))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)), [incidents, status, severity, category, q]);
  const c = (s: IncidentStatus) => incidents.filter(i => i.status === s).length;

  return (
    <>
      <PageHeader title="Incidents / RoadWatch" subtitle="Post road and transport advisories and keep them current."
        actions={<button className="btn primary" type="button" onClick={() => setEditing({})}><Icon name="plus" size={18} />New advisory</button>} />
      <div className="toolbar">
        <SearchBox value={query} onChange={setQuery} placeholder="Search incidents or areas" label="Search incidents" />
        <Chips label="Filter by status" value={status} onChange={setStatus} options={[{ value: 'all', label: 'All', count: incidents.length }, { value: 'active', label: 'Active', count: c('active') }, { value: 'scheduled', label: 'Scheduled', count: c('scheduled') }, { value: 'resolved', label: 'Resolved', count: c('resolved') }]} />
        <label className="select-inline compact"><span className="sr-only">Severity</span><select value={severity} onChange={e => setSeverity(e.target.value as 'all' | AdvisorySeverity)}><option value="all">All severities</option>{Object.entries(severityLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="select-inline compact"><span className="sr-only">Category</span><select value={category} onChange={e => setCategory(e.target.value as 'all' | AdvisoryCategory)}><option value="all">All categories</option>{Object.entries(incidentCategoryLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      </div>

      {rows.length === 0 ? <div className="panel"><EmptyState icon="incident" title="No incidents match" text="Adjust the filters or post a new advisory." /></div> : (
        <ul className="card-list">
          {rows.map(i => (
            <li key={i.id} className={`incident-card sev-${i.severity}${i.status === 'resolved' ? ' is-resolved' : ''}`}>
              <div className="incident-top">
                <div className="incident-tags"><Pill tone={sevTone[i.severity]}>{severityLabels[i.severity]}</Pill><Pill tone={statTone[i.status]}>{i.status}</Pill><span className="tag-text">{incidentCategoryLabels[i.category]}</span>{i.sourceType === 'demo' && <Pill tone="neutral">Simulated (demo data)</Pill>}{i.sourceType === 'official' && <Pill tone="blue">Agency source</Pill>}{i.published === false && <Pill tone="neutral">Not published</Pill>}</div>
                <small>Posted {timeAgo(i.postedAt, now)} by {i.postedBy}</small>
              </div>
              <h2>{i.title}</h2>
              <p>{i.description}</p>
              <dl className="meta-row">
                <div><dt><Icon name="map" size={15} />Affected area</dt><dd>{i.areaName || '—'}</dd></div>
                <div><dt><Icon name="clock" size={15} />Window</dt><dd>{fullDate(i.startsAt)} – {fullDate(i.endsAt)}</dd></div>
                {i.suggestedAction && <div><dt><Icon name="info" size={15} />Suggested action</dt><dd>{i.suggestedAction}</dd></div>}
              </dl>
              <div className="card-actions">
                {i.status !== 'resolved'
                  ? <button type="button" className="btn small ghost" onClick={() => { void run(toast, adminStore.setIncidentStatus(i.id, 'resolved'), 'Marked resolved.'); }}><Icon name="check" size={16} />Mark resolved</button>
                  : <button type="button" className="btn small ghost" onClick={() => { void run(toast, adminStore.setIncidentStatus(i.id, 'active'), 'Advisory reactivated.'); }}>Reactivate</button>}
                <button type="button" className="btn small ghost" onClick={() => setEditing({ incident: i })}><Icon name="edit" size={16} />Edit</button>
                <button type="button" className="btn small ghost danger-text" onClick={() => setDeleting(i)}><Icon name="trash" size={16} />Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && <IncidentForm incident={editing.incident} onClose={() => setEditing(null)} />}
      {deleting && <ConfirmDialog danger title="Remove advisory?" message={<>“{deleting.title}” will be deleted. Resolve it instead if you want to keep a record.</>} confirmLabel="Remove advisory" onCancel={() => setDeleting(null)} onConfirm={() => { setDeleting(null); void run(toast, adminStore.deleteIncident(deleting.id), 'Advisory removed.'); }} />}
    </>
  );
}

function IncidentForm({ incident, onClose }: { incident?: Incident; onClose: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<IncidentDraft>(() => incident ? { title: incident.title, description: incident.description, category: incident.category, severity: incident.severity, status: incident.status, areaName: incident.areaName, suggestedAction: incident.suggestedAction, startsAt: incident.startsAt, endsAt: incident.endsAt } : blank());
  const [errors, setErrors] = useState<Partial<Record<keyof IncidentDraft, string>>>({});
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof IncidentDraft>(k: K, v: IncidentDraft[K]) => setD(x => ({ ...x, [k]: v }));

  function submit(event: FormEvent) {
    event.preventDefault();
    const e: typeof errors = {};
    if (!d.title.trim()) e.title = 'Add an incident title.'; else if (d.title.length > 100) e.title = 'Keep the title to 100 characters.';
    if (!d.description.trim()) e.description = 'Describe what commuters should know.'; else if (d.description.length > 600) e.description = 'Keep the description to 600 characters.';
    if (!d.areaName.trim()) e.areaName = 'Add the affected area.';
    if (!d.startsAt || !Number.isFinite(Date.parse(d.startsAt))) e.startsAt = 'Choose a start time.';
    if (!d.endsAt || !Number.isFinite(Date.parse(d.endsAt))) e.endsAt = 'Choose an end time.'; else if (Date.parse(d.endsAt) < Date.parse(d.startsAt)) e.endsAt = 'End time must be after the start time.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    void run(toast, adminStore.saveIncident({ ...d, title: d.title.trim(), description: d.description.trim(), areaName: d.areaName.trim(), suggestedAction: d.suggestedAction.trim() }, incident?.id),
      incident ? 'Advisory updated.' : 'Advisory posted.', 'Could not save the advisory.').then(ok => { setSaving(false); if (ok) onClose(); });
  }
  return (
    <Modal title={incident ? 'Edit advisory' : 'New advisory'} onClose={onClose} wide footer={<><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button type="submit" form="incident-form" className="btn primary" disabled={saving}>{incident ? 'Save changes' : 'Post advisory'}</button></>}>
      <form id="incident-form" onSubmit={submit} noValidate className="form-grid">
        <Field label="Incident title" htmlFor="inc-title" error={errors.title}><input id="inc-title" data-autofocus value={d.title} onChange={e => set('title', e.target.value)} aria-invalid={!!errors.title} /></Field>
        <Field label="Category" htmlFor="inc-cat"><select id="inc-cat" value={d.category} onChange={e => set('category', e.target.value as AdvisoryCategory)}>{Object.entries(incidentCategoryLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field label="Description" htmlFor="inc-desc" error={errors.description} hint={`${d.description.length}/600`}><textarea id="inc-desc" rows={3} value={d.description} onChange={e => set('description', e.target.value)} aria-invalid={!!errors.description} /></Field>
        <Field label="Severity" htmlFor="inc-sev"><select id="inc-sev" value={d.severity} onChange={e => set('severity', e.target.value as AdvisorySeverity)}>{Object.entries(severityLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field label="Affected area" htmlFor="inc-area" error={errors.areaName}><input id="inc-area" value={d.areaName} onChange={e => set('areaName', e.target.value)} aria-invalid={!!errors.areaName} /></Field>
        <Field label="Status" htmlFor="inc-status"><select id="inc-status" value={d.status} onChange={e => set('status', e.target.value as IncidentStatus)}><option value="active">Active</option><option value="scheduled">Scheduled</option><option value="resolved">Resolved</option></select></Field>
        <Field label="Starts" htmlFor="inc-start" error={errors.startsAt}><input id="inc-start" type="datetime-local" value={toLocalInput(d.startsAt)} onChange={e => set('startsAt', fromLocalInput(e.target.value))} /></Field>
        <Field label="Ends" htmlFor="inc-end" error={errors.endsAt}><input id="inc-end" type="datetime-local" value={toLocalInput(d.endsAt)} onChange={e => set('endsAt', fromLocalInput(e.target.value))} aria-invalid={!!errors.endsAt} /></Field>
        <Field label="Suggested action (optional)" htmlFor="inc-action"><input id="inc-action" value={d.suggestedAction} maxLength={200} onChange={e => set('suggestedAction', e.target.value)} /></Field>
      </form>
    </Modal>
  );
}
