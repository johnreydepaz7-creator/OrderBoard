// Phase 2.1 order screen. Kept separate so Phase 1 authentication remains unchanged.
import React, { useEffect, useRef, useState } from 'react';

const STATUS = ['All', 'Pending', 'Confirmed', 'In production', 'Ready', 'Completed', 'Cancelled'];
const NEXT = { Pending: ['Confirmed', 'Cancelled'], Confirmed: ['In production', 'Cancelled'], 'In production': ['Ready', 'Cancelled'], Ready: ['Completed', 'Cancelled'] };
const BLANK = { customerName: '', contact: '', source: 'Walk-in', items: [{ name: '', quantity: 1, unitPrice: '' }], notes: '', paymentStatus: 'Unpaid' };
const money = value => `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Orders({ request }) {
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const creationKey = useRef(null);
  const modalRef = useRef(null);
  const firstFieldRef = useRef(null);

  // Keep keyboard focus in the pop-up and close it with Escape (when not saving).
  useEffect(() => {
    if (!showForm) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    firstFieldRef.current?.focus();
    function onKeyDown(event) {
      if (event.key === 'Escape' && !busy) { event.preventDefault(); setShowForm(false); }
      if (event.key === 'Tab' && modalRef.current) {
        const controls = [...modalRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')];
        if (!controls.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKeyDown); previousFocus?.focus?.(); };
  }, [showForm, busy]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search, status: filter, page: String(page) });
      const data = await request(`/api/orders?${params}`);
      setOrders(data.orders); setPages(data.pages); setCount(data.count); setError('');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [filter, page, search]);
  function changeItem(index, field, value) {
    setForm(previous => ({ ...previous, items: previous.items.map((item, i) => i === index ? { ...item, [field]: value } : item) }));
  }
  function startCreate() { creationKey.current=crypto.randomUUID(); setEditing(null); setForm({ ...BLANK, items: [{ name: '', quantity: 1, unitPrice: '' }] }); setError(''); setNotice(''); setShowForm(true); }
  function startEdit(order) { setEditing(order.id); setForm({ customerName: order.customerName, contact: order.contact, source: order.source, items: order.items.map(i => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice })), notes: order.notes, paymentStatus: order.paymentStatus }); setError(''); setNotice(''); setShowForm(true); }
  async function save(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (form.items.some(i => !Number.isFinite(Number(i.unitPrice)) || Number(i.unitPrice) <= 0)) { setError('Every product needs a unit price greater than ₱0.00.'); setBusy(false); return; }
      const payload = { ...form, items: form.items.map(i => ({ name: i.name.trim(), quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) })) };
      await request(editing ? `/api/orders/${editing}` : '/api/orders', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json', ...(!editing ? { 'Idempotency-Key': creationKey.current } : {}) }, body: JSON.stringify(payload) });
      setShowForm(false); setEditing(null); setNotice(editing ? 'Order updated.' : 'Order created.'); setPage(1); await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function changeStatus(order, status) {
    if (busy || !window.confirm(`Change ${order.customerName}'s order from ${order.status} to ${status}?`)) return;
    setBusy(true); setError(''); setNotice('');
    try { await request(`/api/orders/${order.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); setNotice('Order status updated.'); await load(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  const subtotal = form.items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
  return <div className="orders-module">
    <div className="orders-toolbar">
      <div><strong>{count} matching orders</strong><p>Record and track bakery orders in one place.</p></div>
      <button className="order-action" onClick={startCreate}>+ New order</button>
    </div>
    <div className="orders-controls">
      <label>Search customer<input aria-label="Search customer" placeholder="Customer name" maxLength={100} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}/></label>
      <label>Order status<select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}>{STATUS.map(s => <option key={s}>{s}</option>)}</select></label>
    </div>
    {error && !showForm && <div className="error" role="alert">{error}</div>}
    {notice && <div className="success-note" role="status">{notice}</div>}
    {showForm && <div className="order-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setShowForm(false); }}>
      <section className="order-editor order-modal" role="dialog" aria-modal="true" aria-labelledby="order-modal-title" ref={modalRef}>
      <div className="order-section-head"><h3 id="order-modal-title">{editing ? 'Edit order' : 'Create order'}</h3><button type="button" className="status-button" disabled={busy} onClick={() => setShowForm(false)} aria-label="Close order form">✕ Close</button></div>
      {error && <div className="error" role="alert">{error}</div>}
      <form onSubmit={save} className="order-form">
        <label>Customer name<input ref={firstFieldRef} required maxLength={120} value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })}/></label>
        <label>Contact (optional)<input maxLength={100} value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })}/></label>
        <label>Order source<select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>{['Walk-in','Phone','Facebook','Delivery app','Other'].map(s => <option key={s}>{s}</option>)}</select></label>
        <label>Payment status<select value={form.paymentStatus} onChange={e => setForm({ ...form, paymentStatus: e.target.value })}>{['Unpaid','Partially paid','Paid'].map(s => <option key={s}>{s}</option>)}</select></label>
        <div className="order-items"><strong>Order items</strong>{form.items.map((item, index) => <div className="order-item" key={index}>
          <label>Product<input required maxLength={120} value={item.name} onChange={e => changeItem(index, 'name', e.target.value)}/></label>
          <label>Quantity<input type="number" min="1" max="10000" step="1" required value={item.quantity} onChange={e => changeItem(index, 'quantity', e.target.value)}/></label>
          <label>Unit price (₱)<input type="number" min="0.01" max="10000000" step="0.01" required value={item.unitPrice} onChange={e => changeItem(index, 'unitPrice', e.target.value)}/></label>
          <button type="button" className="status-button" disabled={form.items.length === 1} onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== index) })}>Remove</button>
        </div>)}<button type="button" className="status-button" disabled={form.items.length >= 30} onClick={() => setForm({ ...form, items: [...form.items, { name: '', quantity: 1, unitPrice: '' }] })}>+ Add product</button></div>
        <label className="order-wide">Notes (optional)<textarea rows="3" maxLength={1000} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}/></label>
        <div className="order-total">Calculated total: <strong>{money(subtotal)}</strong></div>
        <div className="order-modal-actions"><button type="button" className="status-button" disabled={busy} onClick={() => setShowForm(false)}>Cancel</button><button className="order-action" type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create order'}</button></div>
      </form>
    </section></div>}
    <div className="orders-list">{loading ? <p>Loading orders…</p> : orders.length === 0 ? <p>No orders found.</p> : orders.map(order => <article className="order-card" key={order.id}>
      <div className="order-section-head"><div><h3>{order.customerName}</h3><small>{new Date(order.createdAt).toLocaleString()} · {order.source}</small></div><strong>{money(order.total)}</strong></div>
      <p>{order.items.map(i => `${i.quantity} × ${i.name}`).join(' · ')}</p>
      <div className="order-chips"><span>{order.status}</span><span>{order.paymentStatus}</span>{order.contact && <span>{order.contact}</span>}</div>
      {order.notes && <p className="order-note">{order.notes}</p>}
      <div className="order-buttons">{!['Completed','Cancelled'].includes(order.status) && <button className="status-button" onClick={() => startEdit(order)}>Edit</button>}{(NEXT[order.status] || []).map(status => <button key={status} className="status-button" disabled={busy} onClick={() => changeStatus(order, status)}>{status === 'Cancelled' ? 'Cancel order' : `Mark ${status}`}</button>)}</div>
    </article>)}</div>
    <div className="orders-pagination"><button className="status-button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button className="status-button" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div>
  </div>;
}
