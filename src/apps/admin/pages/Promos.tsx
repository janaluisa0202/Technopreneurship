import { useMemo, useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { Chips, ConfirmDialog, EmptyState, Field, Modal, PageHeader, Pill, SearchBox, useDebounced, useToast } from '../components/ui';
import { adminStore, useAdminState, ValidationError } from '../services/store';
import { dateOnly, todayISO } from '../lib/format';
import { promoTypeLabels } from '../lib/labels';
import type { Promo, PromoDraft, PromoType } from '../types';

type Effective = 'active' | 'inactive' | 'expired' | 'upcoming';
const effective = (p: Promo, today: string): Effective => (p.endDate < today ? 'expired' : p.status === 'inactive' ? 'inactive' : p.startDate > today ? 'upcoming' : 'active');
const tone = { active: 'green', inactive: 'neutral', expired: 'red', upcoming: 'blue' } as const;

const blank = (): PromoDraft => ({ title: '', description: '', type: 'student', startDate: todayISO(), endDate: todayISO(), appliesTo: '', status: 'inactive' });

export function Promos() {
  const { promos } = useAdminState();
  const toast = useToast();
  const today = todayISO();
  const [query, setQuery] = useState('');
  const q = useDebounced(query).trim().toLowerCase();
  const [filter, setFilter] = useState<'all' | Effective>('all');
  const [editing, setEditing] = useState<{ promo?: Promo } | null>(null);
  const [deleting, setDeleting] = useState<Promo | null>(null);

  const withState = useMemo(() => promos.map(p => ({ p, e: effective(p, today) })), [promos, today]);
  const counts = (e: Effective) => withState.filter(x => x.e === e).length;
  const rows = withState.filter(({ p, e }) => (filter === 'all' || e === filter) && (!q || `${p.title} ${p.description} ${p.appliesTo}`.toLowerCase().includes(q)));

  return (
    <>
      <PageHeader title="Promo management" subtitle="Add, edit, activate and deactivate promos shown to commuters."
        actions={<button className="btn primary" type="button" onClick={() => setEditing({})}><Icon name="plus" size={18} />New promo</button>} />
      <div className="toolbar">
        <SearchBox value={query} onChange={setQuery} placeholder="Search promos" label="Search promos" />
        <Chips label="Filter promos by status" value={filter} onChange={setFilter} options={[
          { value: 'all', label: 'All', count: promos.length }, { value: 'active', label: 'Active', count: counts('active') },
          { value: 'upcoming', label: 'Upcoming', count: counts('upcoming') }, { value: 'inactive', label: 'Inactive', count: counts('inactive') },
          { value: 'expired', label: 'Expired', count: counts('expired') },
        ]} />
      </div>

      {rows.length === 0 ? <div className="panel"><EmptyState icon="promo" title={promos.length ? 'No promos match your filters' : 'No promos yet'} text={promos.length ? 'Try a different search or status.' : 'Create the first promo for commuters.'} action={!promos.length ? <button className="btn primary" type="button" onClick={() => setEditing({})}>New promo</button> : undefined} /></div> : (
        <div className="panel table-panel">
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th scope="col">Promo</th><th scope="col">Type</th><th scope="col">Applies to</th><th scope="col">Runs</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {rows.map(({ p, e }) => (
                  <tr key={p.id}>
                    <td className="cell-main"><strong>{p.title}</strong><span className="clamp">{p.description}</span></td>
                    <td>{promoTypeLabels[p.type]}</td>
                    <td>{p.appliesTo || '—'}</td>
                    <td className="nowrap">{dateOnly(p.startDate)} – {dateOnly(p.endDate)}</td>
                    <td><Pill tone={tone[e]}>{e}</Pill></td>
                    <td>
                      <div className="row-actions">
                        {e !== 'expired' && (
                          <button type="button" className="btn small ghost" onClick={() => { adminStore.setPromoStatus(p.id, p.status === 'active' ? 'inactive' : 'active'); toast(p.status === 'active' ? 'Promo deactivated.' : 'Promo activated.'); }}>
                            {p.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                        <button type="button" className="icon-btn" aria-label={`Edit ${p.title}`} onClick={() => setEditing({ promo: p })}><Icon name="edit" size={18} /></button>
                        <button type="button" className="icon-btn danger" aria-label={`Delete ${p.title}`} onClick={() => setDeleting(p)}><Icon name="trash" size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && <PromoForm promo={editing.promo} onClose={() => setEditing(null)} />}
      {deleting && <ConfirmDialog danger title="Delete promo?" message={<>“{deleting.title}” will be removed for commuters. This cannot be undone.</>} confirmLabel="Delete promo"
        onCancel={() => setDeleting(null)} onConfirm={() => { adminStore.deletePromo(deleting.id); setDeleting(null); toast('Promo deleted.'); }} />}
    </>
  );
}

function PromoForm({ promo, onClose }: { promo?: Promo; onClose: () => void }) {
  const toast = useToast();
  const [draft, setDraft] = useState<PromoDraft>(() => promo ? { title: promo.title, description: promo.description, type: promo.type, startDate: promo.startDate, endDate: promo.endDate, appliesTo: promo.appliesTo, status: promo.status } : blank());
  const [errors, setErrors] = useState<Partial<Record<keyof PromoDraft, string>>>({});
  const set = <K extends keyof PromoDraft>(key: K, value: PromoDraft[K]) => setDraft(d => ({ ...d, [key]: value }));

  function submit(event: FormEvent) {
    event.preventDefault();
    const next: typeof errors = {};
    if (!draft.title.trim()) next.title = 'Add a promo title.';
    else if (draft.title.trim().length > 80) next.title = 'Keep the title to 80 characters.';
    if (!draft.description.trim()) next.description = 'Add a short description.';
    else if (draft.description.length > 500) next.description = 'Keep the description to 500 characters.';
    if (!draft.startDate) next.startDate = 'Choose a start date.';
    if (!draft.endDate) next.endDate = 'Choose an end date.';
    else if (draft.startDate && draft.endDate < draft.startDate) next.endDate = 'End date must be on or after the start date.';
    else if (draft.status === 'active' && draft.endDate < todayISO()) next.endDate = 'An active promo cannot already be expired.';
    if (draft.appliesTo.length > 120) next.appliesTo = 'Keep this to 120 characters.';
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      adminStore.savePromo({ ...draft, title: draft.title.trim(), description: draft.description.trim(), appliesTo: draft.appliesTo.trim() }, promo?.id);
      toast(promo ? 'Promo updated.' : 'Promo added.');
      onClose();
    } catch (error) { toast(error instanceof ValidationError ? error.message : 'Could not save the promo.', 'error'); }
  }

  return (
    <Modal title={promo ? 'Edit promo' : 'New promo'} onClose={onClose} wide footer={<>
      <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
      <button type="submit" form="promo-form" className="btn primary">{promo ? 'Save changes' : 'Add promo'}</button>
    </>}>
      <form id="promo-form" onSubmit={submit} noValidate className="form-grid">
        <Field label="Promo title" htmlFor="promo-title" error={errors.title}><input id="promo-title" data-autofocus value={draft.title} maxLength={90} onChange={e => set('title', e.target.value)} aria-invalid={!!errors.title} /></Field>
        <Field label="Promo type" htmlFor="promo-type"><select id="promo-type" value={draft.type} onChange={e => set('type', e.target.value as PromoType)}>{Object.entries(promoTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field label="Description" htmlFor="promo-desc" error={errors.description} hint={`${draft.description.length}/500`}><textarea id="promo-desc" rows={3} value={draft.description} onChange={e => set('description', e.target.value)} aria-invalid={!!errors.description} /></Field>
        <Field label="Start date" htmlFor="promo-start" error={errors.startDate}><input id="promo-start" type="date" value={draft.startDate} onChange={e => set('startDate', e.target.value)} /></Field>
        <Field label="End date" htmlFor="promo-end" error={errors.endDate}><input id="promo-end" type="date" value={draft.endDate} min={draft.startDate} onChange={e => set('endDate', e.target.value)} aria-invalid={!!errors.endDate} /></Field>
        <Field label="Applicable route / transport type" htmlFor="promo-applies" error={errors.appliesTo} hint="Example: Jeepney / UV Express · UST – España area"><input id="promo-applies" value={draft.appliesTo} onChange={e => set('appliesTo', e.target.value)} /></Field>
        <Field label="Status" htmlFor="promo-status"><select id="promo-status" value={draft.status} onChange={e => set('status', e.target.value as Promo['status'])}><option value="inactive">Inactive (hidden from commuters)</option><option value="active">Active</option></select></Field>
      </form>
    </Modal>
  );
}
