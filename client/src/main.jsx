// OrderBoard React frontend. React components are functions returning JSX (page layout).
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  LayoutDashboard, ClipboardList, Cake, CalendarDays, Package, Wallet,
  BarChart3, Settings, LogOut, Menu, ShieldCheck, Eye, EyeOff,
  AlertCircle, Users, UserPlus, History, KeyRound, Laptop,
} from 'lucide-react';
import './styles.css';
// API is the Express server address. Configure VITE_API_URL in client/.env.
const API=import.meta.env.VITE_API_URL||'http://localhost:4000';
// Shared helper: call the backend and show a friendly error if it fails.
// credentials:'include' is needed for the secure login cookie.
async function request(path,options={}){let res;try{res=await fetch(`${API}${path}`,{credentials:'include',headers:{'Content-Type':'application/json'},...options});}catch{throw Error('Cannot connect to the server. Check your connection.');}const body=await res.json();if(!res.ok)throw Error(body.message||'Request failed');return body;}
// These sections will be implemented in later development phases.
const navigation=[['Dashboard',LayoutDashboard],['Orders & Reservations',ClipboardList],['Cake Production',Cake],['Schedules',CalendarDays],['Inventory',Package],['Sales & Expenses',Wallet],['Reports & Analytics',BarChart3]];
// Owner-only screen: create, list and activate/deactivate staff accounts.
function StaffManager(){
 const [staff,setStaff]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[saving,setSaving]=useState(false),[name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[selectedHistory,setSelectedHistory]=useState(null);
 async function showStaffHistory(person){setError('');try{const result=await request(`/api/security/staff/${person.id}/history`);setSelectedHistory(result);}catch(e){setError(e.message);}}
 async function revokeStaffSessions(person){if(!window.confirm(`Sign out all devices for ${person.name}?`))return;setError('');try{await request(`/api/security/staff/${person.id}/revoke`,{method:'POST'});setNotice('Staff sessions revoked.');}catch(e){setError(e.message);}}
 async function load(){setLoading(true);try{const r=await request('/api/staff');setStaff(r.staff);setError('');}catch(e){setError(e.message);}finally{setLoading(false);}}
 useEffect(()=>{load();},[]);
 async function create(e){e.preventDefault();setSaving(true);setError('');setNotice('');try{await request('/api/staff',{method:'POST',body:JSON.stringify({name,email,password})});setName('');setEmail('');setPassword('');setNotice('Staff account created successfully.');await load();}catch(e){setError(e.message);}finally{setSaving(false);}}
 async function toggle(person){if(!window.confirm(`${person.active?'Deactivate':'Reactivate'} ${person.name}?`))return;setSaving(true);setError('');setNotice('');try{await request(`/api/staff/${person.id}/status`,{method:'PATCH',body:JSON.stringify({active:!person.active})});setNotice('Staff status updated.');await load();}catch(e){setError(e.message);}finally{setSaving(false);}}
 return <div className="staff-layout"><section className="staff-panel"><h3><UserPlus size={19}/> Create staff account</h3><p>Only the Owner can create accounts. Staff passwords are never shown or stored as plain text.</p><form onSubmit={create} className="staff-form"><label>Full name<input required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="Staff full name"/></label><label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="staff@example.com"/></label><label>Temporary password (at least 12 characters)<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Choose a unique password"/></label><button className="primary" disabled={saving} type="submit">{saving?'Saving…':'Create staff account'}</button></form></section><section className="staff-panel"><h3><Users size={19}/> Staff accounts</h3><p>Deactivated accounts cannot sign in or continue using protected APIs.</p>{error&&<div role="alert" className="error">{error}</div>}{notice&&<div role="status" className="success-note">{notice}</div>}{loading?<p>Loading staff accounts…</p>:staff.length===0?<p>No staff accounts yet.</p>:<div className="staff-list">{staff.map(person=><div key={person.id} className="staff-record"><div className="staff-person"><strong>{person.name}</strong><span>{person.email}</span><small>{person.active?'Active':'Deactivated'}</small></div><button type="button" className="status-button" onClick={()=>showStaffHistory(person)}>History</button><button type="button" className="status-button" onClick={()=>revokeStaffSessions(person)}>Sign out devices</button><button type="button" className="status-button" disabled={saving} onClick={()=>toggle(person)}>{person.active?'Deactivate':'Reactivate'}</button></div>)}</div>}</section>{selectedHistory&&<section className="staff-panel"><h3>Login history — {selectedHistory.staff.name}</h3><button className="status-button" onClick={()=>setSelectedHistory(null)}>Close history</button><div className="staff-list">{selectedHistory.history.length?selectedHistory.history.map(event=><div className="staff-record" key={event.id}><div className="staff-person"><strong>{event.outcome==='success'?'Successful login':'Failed login'}</strong><span>{event.device} · {event.browser}</span><small>{new Date(event.createdAt).toLocaleString()} · IP: {event.ipAddress}</small></div></div>):<p>No login history yet.</p>}</div></section>}</div>;
}

// Security Center is available to both Owner and Staff.
// It reads active browser sessions and the last 50 login events from MongoDB.
function SecurityCenter({ onSignedOut }) {
  const [history, setHistory] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  async function reload() {
    try {
      const [historyData, sessionData] = await Promise.all([
        request('/api/security/history'),
        request('/api/security/sessions'),
      ]);
      setHistory(historyData.history);
      setSessions(sessionData.sessions);
      setError('');
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { reload(); }, []);

  async function updatePassword(event) {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      await request('/api/auth/change-password', {
        method: 'POST', body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword(''); setNewPassword('');
      // Password changes terminate ALL sessions, even this one.
      window.alert('Password changed. Sign in again with the new password.');
      onSignedOut();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function revokeOthers() {
    if (!window.confirm('Sign out every OTHER device?')) return;
    setBusy(true);
    try {
      const result = await request('/api/security/sessions/revoke-others', { method: 'POST' });
      setNotice(result.message); await reload();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function revokeSession(session) {
    if (!window.confirm(`Sign out ${session.device} / ${session.browser}?`)) return;
    setBusy(true);
    try {
      const result = await request(`/api/security/sessions/${session.id}/revoke`, { method: 'POST' });
      if (result.currentSessionRevoked) return onSignedOut();
      setNotice(result.message); await reload();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  function dateText(value) { return new Date(value).toLocaleString(); }
  return <div className="security-layout">
    <section className="staff-panel">
      <h3><KeyRound size={19}/> Change password</h3>
      <p>Changing your password signs out all devices, including this browser.</p>
      <form className="staff-form" onSubmit={updatePassword}>
        <label>Current password<input type="password" autoComplete="current-password" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}/></label>
        <label>New password (12 characters or more)<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={newPassword} onChange={e => setNewPassword(e.target.value)}/></label>
        <button type="submit" className="primary" disabled={busy}>Change password</button>
      </form>
      {error && <div role="alert" className="error">{error}</div>}
      {notice && <div role="status" className="success-note">{notice}</div>}
    </section>
    <section className="staff-panel">
      <h3><Laptop size={19}/> Active sessions</h3>
      <p>Browser and device labels are estimates, not guaranteed device identities.</p>
      <button className="status-button" disabled={busy} onClick={revokeOthers}>Sign out other devices</button>
      <div className="staff-list">{sessions.length ? sessions.map(session =>
        <div key={session.id} className="staff-record">
          <div className="staff-person"><strong>{session.device} · {session.browser} {session.current ? '(Current)' : ''}</strong>
            <span>Signed in: {dateText(session.createdAt)}</span><small>IP: {session.ipAddress}</small></div>
          <button type="button" className="status-button" disabled={busy} onClick={() => revokeSession(session)}>Sign out</button>
        </div>) : <p>No active sessions found.</p>}</div>
    </section>
    <section className="staff-panel">
      <h3><History size={19}/> Recent login history</h3>
      <p>The 50 most recent sign-in attempts associated with your account. History is retained for 90 days.</p>
      <div className="staff-list">{history.length ? history.map(event =>
        <div className="staff-record" key={event.id}>
          <div className="staff-person"><strong>{event.outcome === 'success' ? 'Successful login' : 'Failed login'}</strong>
            <span>{event.device} · {event.browser} · {dateText(event.createdAt)}</span>
            <small>IP: {event.ipAddress}</small></div>
        </div>) : <p>No login history yet.</p>}</div>
    </section>
  </div>;
}

// Main app: login screen when signed out, dashboard when signed in.
function App(){const[user,setUser]=useState(null),[checking,setChecking]=useState(true),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[showPassword,setShowPassword]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[page,setPage]=useState('Dashboard'),[menu,setMenu]=useState(false);
useEffect(()=>{request('/api/auth/me').then(r=>setUser(r.user)).catch(()=>{}).finally(()=>setChecking(false));},[]);
async function login(e){e.preventDefault();setBusy(true);setError('');try{const data=await request('/api/auth/login',{method:'POST',body:JSON.stringify({email,password})});setUser(data.user);setPassword('');}catch(e){setError(e.message);}finally{setBusy(false);}}
async function logout(){try{await request('/api/auth/logout',{method:'POST'});}finally{setUser(null);setPage('Dashboard');}}
if(checking)return <div className="center">Loading OrderBoard…</div>;
if(!user)return <main className="login-layout"><section className="brand-panel"><div className="eyebrow">BAKES & BITES</div><h1>Smarter bakery operations start here.</h1><p>Your workspace for order management, production schedules, and business insights.</p><div className="decor">✳ &nbsp; ORDERBOARD</div></section><section className="login-area"><form className="login-card" onSubmit={login}><div className="symbol">OB</div><h2>Welcome back</h2><p>Sign in to your OrderBoard workspace.</p><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/><label htmlFor="password">Password</label><div className="password"><input id="password" type={showPassword?'text':'password'} autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password"/><button type="button" aria-label={showPassword?'Hide password':'Show password'} onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff size={19}/>:<Eye size={19}/>}</button></div>{error&&<div role="alert" className="error"><AlertCircle size={16}/>{error}</div>}<button className="primary" type="submit" disabled={busy}>{busy?'Signing in…':'Sign in'}</button><span className="secure"><ShieldCheck size={15}/> Authorized owner and staff only</span></form></section></main>;
return <div className="app"><aside className={'sidebar '+(menu?'open':'')}><div className="sidebar-brand"><div className="symbol">OB</div><div><strong>OrderBoard</strong><small>BAKES & BITES</small></div></div><div className="side-caption">WORKSPACE</div><nav>{[...navigation,...(user.role==='owner'?[['Staff Accounts',Users]]:[]),['Account Security',ShieldCheck]].filter(([label])=>user.role==='owner'||!['Sales & Expenses','Reports & Analytics'].includes(label)).map(([label,Icon])=><button key={label} className={page===label?'active':''} onClick={()=>{setPage(label);setMenu(false)}}><Icon size={19}/>{label}</button>)}</nav><div className="sidebar-bottom"><div className="userpic">{user.name.slice(0,1).toUpperCase()}</div><div className="userlabel"><strong>{user.name}</strong><small>{user.role==='owner'?'Owner / Administrator':'Staff'}</small></div><button title="Log out" aria-label="Log out" onClick={logout}><LogOut size={19}/></button></div></aside><main className="main"><header className="topbar"><button className="hamburger" aria-label="Toggle menu" onClick={()=>setMenu(!menu)}><Menu size={23}/></button><span>OrderBoard <b>/ {page}</b></span><span className="role">{user.role==='owner'?'OWNER':'STAFF'}</span></header><div className="content"><div className="heading"><div><div className="eyebrow">OPERATIONS WORKSPACE</div><h1>{page}</h1><p>{page==='Dashboard'?`Welcome, ${user.name}. Your bakery management workspace is ready.`:'Module reserved for the next development phase.'}</p></div><div className="phase">PHASE 1 · FOUNDATION</div></div>{page==='Staff Accounts'&&user.role==='owner'?<StaffManager/>:page==='Account Security'?<SecurityCenter onSignedOut={()=>{setUser(null);setPage('Dashboard');}}/>:page==='Dashboard'?<><div className="metrics">{[['Total Orders','—','Awaiting order module'],['In Production','—','Awaiting production module'],['Upcoming Pickups','—','Awaiting scheduling module'],['Sales Overview','—','Awaiting sales module']].map(([t,v,d])=><article className="metric" key={t}><small>{t}</small><div>{v}</div><p>{d}</p></article>)}</div><div className="welcome"><div className="icon-circle"><ShieldCheck size={26}/></div><div><h3>Foundation is ready</h3><p>Secure authentication, role identification, and responsive navigation are in place. Order, production, and financial data will appear as later modules are implemented.</p></div></div></>:<div className="placeholder"><div className="icon-circle"><Settings size={28}/></div><h3>{page}</h3><p>This section is a navigation placeholder, not yet an operational feature.</p></div>}</div></main>{menu&&<button className="overlay" aria-label="Close menu" onClick={()=>setMenu(false)}/>}</div>;
}
// Mount the React app inside the <div id='root'> in index.html.
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
