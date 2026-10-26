// Phase 2.3 Custom Cake Tracking. Forms open in the existing OrderBoard modal style.
import React, { useEffect, useRef, useState } from 'react';
const empty = { customerName: '', contact: '', cakeDescription: '', size: '', flavor: '', designInstructions: '', quantity: 1, dueAt: '' };
const statuses = ['All', 'Queued', 'Preparing', 'Decorating', 'Ready', 'Completed', 'Cancelled'];
const next = { Queued: ['Preparing', 'Cancelled'], Preparing: ['Decorating', 'Cancelled'], Decorating: ['Ready', 'Cancelled'], Ready: ['Completed', 'Cancelled'] };
const localDate = value => { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const niceDate = value => new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
export default function CakeProduction({ request }) {
  const [cakes, setCakes] = useState([]), [search, setSearch] = useState(''), [filter, setFilter] = useState('All');
  const [page, setPage] = useState(1), [pages, setPages] = useState(1), [count, setCount] = useState(0);
  const [editing, setEditing] = useState(null), [form, setForm] = useState(empty), [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const modal = useRef(null), first = useRef(null), submissionKey = useRef(null);
  async function load() {
    setLoading(true);
    try {
      const query = new URLSearchParams({ search, status: filter, page: String(page) });
      const result = await request(`/api/cake-jobs?${query}`);
      setCakes(result.cakes); setCount(result.count); setPages(result.pages); setError('');
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [search, filter, page]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; first.current?.focus();
    function onKey(e) {
      if (e.key === 'Escape' && !busy) { e.preventDefault(); setOpen(false); }
      if (e.key !== 'Tab') return;
      const controls = [...modal.current.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled)')];
      if (e.shiftKey && document.activeElement === controls[0]) { e.preventDefault(); controls.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === controls.at(-1)) { e.preventDefault(); controls[0].focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [open, busy]);
  function newCake() { submissionKey.current = crypto.randomUUID(); setEditing(null); setForm({ ...empty }); setError(''); setNotice(''); setOpen(true); }
  function editCake(cake) {
    const { customerName, contact, cakeDescription, size, flavor, designInstructions, quantity } = cake;
    setForm({ customerName, contact, cakeDescription, size, flavor, designInstructions, quantity, dueAt: localDate(cake.dueAt) });
    submissionKey.current = null; setEditing(cake.id); setError(''); setNotice(''); setOpen(true);
  }
  function field(name, value) { setForm(prev => ({ ...prev, [name]: value })); }
  async function save(e) {
    e.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      const data = { ...form, quantity: Number(form.quantity), dueAt: new Date(form.dueAt).toISOString() };
      await request(editing ? `/api/cake-jobs/${editing}` : '/api/cake-jobs', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json', ...(!editing ? { 'Idempotency-Key': submissionKey.current } : {}) }, body: JSON.stringify(data) });
      submissionKey.current = null; setOpen(false); setNotice(editing ? 'Cake job updated.' : 'Cake job created.'); setPage(1); await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function changeStatus(cake, status) {
    if (busy || !window.confirm(`Change ${cake.customerName}'s cake to ${status}?`)) return;
    setBusy(true); setError('');
    try { await request(`/api/cake-jobs/${cake.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); setNotice('Production status updated.'); await load(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <div className="orders-module">
    <div className="orders-toolbar"><div><strong>{count} matching cake jobs</strong><p>Track custom cake details, production and delivery deadlines.</p></div><button className="order-action" onClick={newCake}>+ New cake job</button></div>
    <div className="orders-controls"><label>Search customer or cake<input placeholder="Search cake jobs" maxLength={100} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}/></label><label>Production status<select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}>{statuses.map(s => <option key={s}>{s}</option>)}</select></label></div>
    {!open && error && <div className="error" role="alert">{error}</div>}{notice && <div className="success-note" role="status">{notice}</div>}
    {open && <div className="order-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busy) setOpen(false); }}>
      <section className="order-editor order-modal" role="dialog" aria-modal="true" aria-labelledby="cake-form-title" ref={modal}>
        <div className="order-section-head"><h3 id="cake-form-title">{editing ? 'Edit custom cake' : 'New custom cake'}</h3><button type="button" className="status-button" disabled={busy} onClick={() => setOpen(false)}>✕ Close</button></div>
        {error && <div className="error" role="alert">{error}</div>}
        <form className="order-form" onSubmit={save}>
          <label>Customer name<input ref={first} required maxLength={120} value={form.customerName} onChange={e => field('customerName', e.target.value)}/></label>
          <label>Contact (optional)<input maxLength={100} value={form.contact} onChange={e => field('contact', e.target.value)}/></label>
          <label className="order-wide">Cake description<input required maxLength={300} value={form.cakeDescription} onChange={e => field('cakeDescription', e.target.value)} placeholder="e.g. Birthday cake"/></label>
          <label>Size / shape<input required maxLength={80} value={form.size} onChange={e => field('size', e.target.value)} placeholder="e.g. 8-inch round"/></label>
          <label>Flavor<input required maxLength={100} value={form.flavor} onChange={e => field('flavor', e.target.value)}/></label>
          <label>Quantity<input type="number" required min="1" max="1000" step="1" value={form.quantity} onChange={e => field('quantity', e.target.value)}/></label>
          <label>Required date and time<input type="datetime-local" required min={localDate(Date.now())} value={form.dueAt} onChange={e => field('dueAt', e.target.value)}/></label>
          <label className="order-wide">Design / dedication / special instructions<textarea rows="4" maxLength={1500} value={form.designInstructions} onChange={e => field('designInstructions', e.target.value)}/></label>
          <div className="order-modal-actions"><button className="status-button" type="button" disabled={busy} onClick={() => setOpen(false)}>Cancel</button><button className="order-action" type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create cake job'}</button></div>
        </form>
      </section>
    </div>}
    <div className="orders-list">{loading ? <p>Loading cake jobs…</p> : cakes.length === 0 ? <p>No cake jobs found.</p> : cakes.map(cake => <article className="order-card" key={cake.id}>
      <div className="order-section-head"><div><h3>{cake.customerName}</h3><small>Required: {niceDate(cake.dueAt)}</small></div><strong>{cake.status}</strong></div>
      <p><strong>{cake.quantity} × {cake.cakeDescription}</strong></p><p>Size: {cake.size} · Flavor: {cake.flavor}</p>
      {cake.contact && <p>Contact: {cake.contact}</p>}{cake.designInstructions && <p>Instructions: {cake.designInstructions}</p>}
      <div className="order-buttons">{!['Completed', 'Cancelled'].includes(cake.status) && <button className="status-button" disabled={busy} onClick={() => editCake(cake)}>Edit</button>}{(next[cake.status] || []).map(status => <button key={status} className="status-button" disabled={busy} onClick={() => changeStatus(cake, status)}>{status === 'Cancelled' ? 'Cancel job' : `Mark ${status}`}</button>)}</div>
    </article>)}</div>
    <div className="orders-pagination"><button className="status-button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page} of {pages}</span><button className="status-button" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next</button></div>
  </div>;
}
