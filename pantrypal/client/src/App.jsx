import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Routes, Route, Link, NavLink, useNavigate, useParams } from 'react-router-dom';
const STAPLE = ['salt', 'water', 'oil', 'sugar', 'black pepper', 'pepper'];
async function api(p, o = {}) {
  const t = localStorage.pp_t;
  const r = await fetch('/api' + p, { ...o, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: o.body && JSON.stringify(o.body) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Request failed (is the server running?)'); return j
}
const Ctx = createContext(), useA = () => useContext(Ctx);
const tmin = t => { const k = t.match(/(\d+)(?:\s*(?:-|to)\s*\d+)?\s*(hours?|hrs?|minutes?|mins?)/i); return k ? (+k[1]) * (/h/i.test(k[2]) ? 60 : 1) : 0 };

export default function App() {
  const [diet, setD] = useState(localStorage.pp_d || 'veg'), [user, setUser] = useState(JSON.parse(localStorage.pp_u || 'null')), [favs, setFavs] = useState(JSON.parse(localStorage.pp_f || '[]')),
    [dark, setDark] = useState(localStorage.pp_dk ? localStorage.pp_dk === '1' : matchMedia('(prefers-color-scheme:dark)').matches),
    [fr, setFr] = useState(new Set()), [use, setUse] = useState(new Set()), [msg, setMsg] = useState('');
  useEffect(() => { document.body.dataset.diet = diet; document.body.classList.toggle('dark', dark) }, [diet, dark]);
  useEffect(() => { if (user) api('/users/favorites').then(l => setFavs(l.map(x => x._id))).catch(() => { }) }, [user]);
  const toast = t => { setMsg(t); setTimeout(() => setMsg(''), 2200) };
  const toggleFav = async id => {
    if (user) { try { setFavs(await api('/users/favorites', { method: 'POST', body: { id } })) } catch (e) { return toast(e.message) } }
    else { const n = favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id]; setFavs(n); localStorage.pp_f = JSON.stringify(n) }
  };
  const login = r => { localStorage.pp_t = r.token; localStorage.pp_u = JSON.stringify(r.user); setUser(r.user) };
  const logout = () => { localStorage.removeItem('pp_t'); localStorage.removeItem('pp_u'); setUser(null); setFavs(JSON.parse(localStorage.pp_f || '[]')) };
  const V = { diet, fr, setFr, use, setUse, favs, toggleFav, user, login, toast };
  const nav = <><NavLink to="/" end>Recipes</NavLink><NavLink to="/fridge">Fridge</NavLink><NavLink to="/saved">Saved</NavLink></>;
  return <Ctx.Provider value={V}>
    <header><Link className="logo" to="/">PantryPal</Link><nav className="dn">{nav}</nav>
      <div className="dt" role="group" aria-label="Diet mode">{[['veg', 'Veg'], ['nonveg', 'Non-veg'], ['jain', 'Jain']].map(([k, l]) => <button key={k} className={diet === k ? 'on' : ''} onClick={() => { setD(k); localStorage.pp_d = k }}>{l}</button>)}</div>
      <button className="sm" onClick={() => { setDark(!dark); localStorage.pp_dk = dark ? '0' : '1' }}>{dark ? 'Light' : 'Dark'}</button>
      {user ? <button className="sm" onClick={logout}>Log out</button> : <Link className="sm" to="/login">Log in</Link>}</header>
    <main><Routes><Route path="/" element={<Home />} /><Route path="/fridge" element={<Fridge />} /><Route path="/saved" element={<Saved />} />
      <Route path="/recipe/:id" element={<Recipe />} /><Route path="/cook/:id" element={<Cook />} /><Route path="/login" element={<Login />} /></Routes></main>
    <nav className="bn">{nav}</nav>{msg && <div className="toast">{msg}</div>}</Ctx.Provider>
}

function Card({ r }) {
  const { favs, toggleFav } = useA(), on = favs.includes(r._id);
  return <Link className="card" to={'/recipe/' + r._id}><Pic src={r.image} t={r.title} />
    <div className="t"><b>{r.title}</b><small>{[r.cuisine, r.course, (r.prepTime || 0) + (r.cookTime || 0) ? ((r.prepTime || 0) + (r.cookTime || 0)) + ' min' : null].filter(Boolean).join(' · ')}</small></div>
    <button className="fv" aria-label="Save recipe" onClick={e => { e.preventDefault(); toggleFav(r._id) }}>{on ? '♥' : '♡'}</button></Link>
}

function Home() {
  const { diet, toast } = useA(), nav = useNavigate(), [q, setQ] = useState(''), [cu, setCu] = useState(''), [tm, setTm] = useState(''), [items, setItems] = useState([]), [total, setTotal] = useState(0), [pg, setPg] = useState(1), [fac, setFac] = useState([]), [busy, setBusy] = useState(true), [err, setErr] = useState('');
  useEffect(() => { api('/facets?diet=' + diet).then(setFac).catch(() => { }) }, [diet]);
  async function load(p) { setBusy(true); try { const r = await api(`/recipes?diet=${diet}&q=${encodeURIComponent(q)}&cuisine=${encodeURIComponent(cu)}&time=${tm}&page=${p}`); setItems(x => p === 1 ? r.items : [...x, ...r.items]); setTotal(r.total); setPg(p); setErr('') } catch (e) { setErr(e.message) } setBusy(false) }
  useEffect(() => { const t = setTimeout(() => load(1), 250); return () => clearTimeout(t) }, [q, cu, tm, diet]);
  const voice = () => { const R = window.SpeechRecognition || window.webkitSpeechRecognition; if (!R) return toast('Voice search is not supported here'); const r = new R(); r.onresult = e => setQ(e.results[0][0].transcript); r.start() };
  return <><section className="hero"><h1>What’s in your kitchen?</h1>
    <div className="sb"><input list="sg" value={q} onChange={e => setQ(e.target.value)} placeholder="Search a dish, ingredient or cuisine" aria-label="Search recipes" /><datalist id="sg">{q && items.slice(0, 8).map(r => <option key={r._id} value={r.title} />)}</datalist><button onClick={voice}>Voice</button></div>
    <div className="chips"><select value={cu} onChange={e => setCu(e.target.value)} aria-label="Cuisine"><option value="">Any cuisine</option>{fac.map(c => <option key={c}>{c}</option>)}</select>
      <select value={tm} onChange={e => setTm(e.target.value)} aria-label="Time"><option value="">Any time</option><option value="20">Under 20 min</option><option value="30">Under 30 min</option><option value="60">Under 1 hour</option></select>
      <button className="ch" onClick={() => items.length && nav('/recipe/' + items[Math.floor(Math.random() * items.length)]._id)}>Surprise me</button></div></section>
    {err && <p className="mut">{err}</p>}
    {!busy && !err && !total && <p className="mut">{q || cu || tm ? 'No match. Try another word or switch diet mode.' : 'The database is empty. Put your dataset CSV in server/seed/data and run: npm run seed'}</p>}
    <div className="grid">{items.map(r => <Card key={r._id} r={r} />)}</div>
    {items.length < total && <div className="row"><button className="btn o" onClick={() => load(pg + 1)}>{busy ? 'Loading…' : 'Show more (' + (total - items.length) + ' left)'}</button></div>}</>
}

function Fridge() {
  const { diet, fr, setFr, use, setUse } = useA(), [ing, setIng] = useState([]), [res, setRes] = useState([]);
  useEffect(() => { api('/ingredients?diet=' + diet).then(setIng).catch(() => { }) }, [diet]);
  useEffect(() => { if (!fr.size) return setRes([]); const t = setTimeout(() => api('/fridge/match', { method: 'POST', body: { ingredients: [...fr], useFirst: [...use], diet } }).then(setRes).catch(() => { }), 200); return () => clearTimeout(t) }, [fr, use, diet]);
  const tap = n => { const a = new Set(fr), b = new Set(use); if (!a.has(n)) a.add(n); else if (!b.has(n)) b.add(n); else { a.delete(n); b.delete(n) } setFr(a); setUse(b) };
  return <><section className="hero"><h1>Cook what you have.</h1><p className="mut">Tap once for “have”, twice for “use first” (★), a third time to clear.</p></section>
    <div className="chips">{ing.map(n => <button key={n} className={'ch' + (fr.has(n) ? ' on' : '')} data-u={use.has(n) ? 1 : 0} onClick={() => tap(n)}>{n}</button>)}</div>
    <h2 style={{ marginTop: 40 }}>Recipes you can make</h2>{!res.length && <p className="mut">Pick a few ingredients and matching recipes will appear here.</p>}
    {res.map(r => {
      const p = Math.round(100 * r.have / Math.max(r.total, 1)); return <Link key={r._id} className="fm" to={'/recipe/' + r._id}>
        <svg viewBox="0 0 36 36" className="ring" aria-hidden="true"><circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--sf)" strokeWidth="4" /><circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--acc)" strokeWidth="4" strokeDasharray={p + ' 100'} transform="rotate(-90 18 18)" /><text x="18" y="21" textAnchor="middle" fontSize="9" fill="currentColor">{p}%</text></svg>
        <div><b>{r.title}</b><small>You have {r.have}/{r.total}{r.missing.length ? ' · missing: ' + r.missing.slice(0, 4).join(', ') : ''}</small></div></Link>
    })}</>
}

function Saved() {
  const { favs } = useA(), [l, setL] = useState([]);
  useEffect(() => { favs.length ? api('/recipes/bulk?ids=' + favs.join(',')).then(setL).catch(() => { }) : setL([]) }, [favs]);
  return <><section className="hero"><h1>Saved</h1></section><div className="grid">{l.map(r => <Card key={r._id} r={r} />)}</div>{!l.length && <p className="mut">Nothing saved yet. Tap the heart on any recipe.</p>}</>
}

function Recipe() {
  const { id } = useParams(), { diet, fr, favs, toggleFav, user, toast } = useA(), [r, setR] = useState(null), [sb, setSb] = useState({});
  useEffect(() => { api('/recipes/' + id).then(setR).catch(e => toast(e.message)) }, [id]);
  if (!r) return <p className="mut pad">Loading…</p>;
  const sub = async n => setSb({ ...sb, [n]: sb[n] ? null : await api(`/substitutes?diet=${diet}&ingredient=${encodeURIComponent(n)}`) });
  const miss = r.ingNames.filter(n => !fr.has(n) && !STAPLE.includes(n)), text = 'Shopping list for ' + r.title + ':\n' + miss.map(n => '• ' + n).join('\n');
  const rate = async v => { if (!user) return toast('Log in to rate recipes'); try { setR({ ...r, ...await api(`/recipes/${id}/rate`, { method: 'POST', body: { value: v } }) }); toast('Thanks for rating') } catch (e) { toast(e.message) } };
  return <article><section className="hero"><span className="bd">{r.isJain ? 'Jain · no onion, garlic or root veg' : r.diet === 'veg' ? 'Vegetarian' : 'Non-veg'}</span><h1 style={{ maxWidth: '18ch' }}>{r.title}</h1>
    <p className="mut">{[r.cuisine, r.course, r.prepTime >= 0 && 'Prep ' + r.prepTime + ' min', r.cookTime >= 0 && 'Cook ' + r.cookTime + ' min', r.calories && r.calories + ' kcal'].filter(Boolean).join(' · ')}</p>
    {r.image && <img src={r.image} alt={r.title} referrerPolicy="no-referrer" onError={e => { e.target.style.display = 'none' }} style={{ maxWidth: '100%', maxHeight: 360 }} />}
    <div className="stars" aria-label="Rate this recipe">{[1, 2, 3, 4, 5].map(v => <button key={v} onClick={() => rate(v)}>{v <= Math.round(r.ratingAvg) ? '★' : '☆'}</button>)}<small style={{ display: 'inline' }}>{r.ratingCount ? r.ratingAvg.toFixed(1) + ' (' + r.ratingCount + ')' : 'No ratings yet'}</small></div>
    <div className="row"><Link className="btn" to={'/cook/' + id}>Start cook mode</Link><button className="btn o" onClick={() => toggleFav(id)}>{favs.includes(id) ? 'Saved ♥' : 'Save ♡'}</button></div></section>
    <div className="cols"><aside><h2>Ingredients</h2>{r.ingredients.map((x, i) => {
      const n = r.ingNames.find(k => k === x.toLowerCase()) || x.toLowerCase(); return <div key={i} className={'ig' + (fr.has(n) ? ' have' : '')}><span>{x}</span><button className="lk" onClick={() => sub(n)}>Don’t have it?</button>
        {sb[n] && (sb[n].length ? sb[n].map(s => <div className="sb2" key={s._id}><b>{s.name}</b> · {s.ratio}<small>{s.note}</small></div>) : <div className="sb2">No safe substitute listed for this diet mode.</div>)}</div>
    })}
      <div className="row"><button className="btn o" onClick={() => { navigator.clipboard?.writeText(text); toast('Shopping list copied') }}>Copy missing items</button><button className="btn o" onClick={() => window.open('https://wa.me/?text=' + encodeURIComponent(text))}>Send to WhatsApp</button></div></aside>
      <section><h2>Method</h2>{r.steps.length ? <ol className="stp">{r.steps.map((s, i) => <li key={i}>{s}</li>)}</ol> : <p className="mut">This dataset has no cooking steps for this recipe. Import a dataset with steps (Food.com or RecipeNLG) to see them here.</p>}</section></div></article>
}

function Cook() {
  const { id } = useParams(), [r, setR] = useState(null), [i, setI] = useState(0), [sp, setSp] = useState(false), [left, setLeft] = useState(0), t = useRef(), sx = useRef(0), nav = useNavigate(), { toast } = useA();
  useEffect(() => { api('/recipes/' + id).then(setR); navigator.wakeLock?.request('screen').catch(() => { }); return () => { clearInterval(t.current); speechSynthesis?.cancel() } }, [id]);
  const say = x => { if (!window.speechSynthesis) return; speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(x)) };
  useEffect(() => { clearInterval(t.current); setLeft(0); if (sp && r?.steps[i]) say(r.steps[i]) }, [i, sp, r]);
  if (!r) return <p className="mut pad">Loading…</p>;
  if (!r.steps.length) return <div className="ck"><Link to={'/recipe/' + id} className="mut">← Back</Link><p className="big">This dataset has no cooking steps for this recipe.</p></div>;
  const go = d => { const n = i + d; if (n < 0) return; if (n >= r.steps.length) { toast('Enjoy your meal'); return nav('/recipe/' + id) } setI(n) }, mn = tmin(r.steps[i]);
  const start = () => { let s = mn * 60; setLeft(s); clearInterval(t.current); t.current = setInterval(() => { s--; setLeft(s); if (s <= 0) { clearInterval(t.current); toast('Timer done'); navigator.vibrate?.([300, 150, 300]); say('Timer done') } }, 1000) };
  return <div className="ck" onTouchStart={e => sx.current = e.touches[0].clientX} onTouchEnd={e => { const d = e.changedTouches[0].clientX - sx.current; if (Math.abs(d) > 60) go(d < 0 ? 1 : -1) }}>
    <Link to={'/recipe/' + id} className="mut">← Exit cook mode</Link><div className="pb"><i style={{ width: 100 * (i + 1) / r.steps.length + '%' }} /></div><small>Step {i + 1} of {r.steps.length}</small>
    <p className="big">{r.steps[i]}</p>{mn > 0 && <button className="btn o" onClick={start}>{left > 0 ? Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0') + ' left' : 'Start ' + mn + ' min timer'}</button>}
    <div className="row"><button className="btn o" onClick={() => go(-1)}>Back</button><button className="btn" onClick={() => go(1)}>{i === r.steps.length - 1 ? 'Done' : 'Next'}</button><button className="btn o" onClick={() => { setSp(!sp); sp && speechSynthesis.cancel() }}>Read aloud: {sp ? 'on' : 'off'}</button></div></div>
}

function Login() {
  const { login, toast } = useA(), nav = useNavigate(), [reg, setReg] = useState(false), [f, setF] = useState({ name: '', email: '', password: '' }), set = k => e => setF({ ...f, [k]: e.target.value });
  const submit = async e => { e.preventDefault(); try { login(await api('/auth/' + (reg ? 'register' : 'login'), { method: 'POST', body: f })); nav('/') } catch (x) { toast(x.message) } };
  return <><section className="hero"><h1>{reg ? 'Create account' : 'Log in'}</h1></section><form className="f" onSubmit={submit}>{reg && <input placeholder="Name" value={f.name} onChange={set('name')} />}
    <input type="email" placeholder="Email" value={f.email} onChange={set('email')} required /><input type="password" placeholder="Password (6+ characters)" value={f.password} onChange={set('password')} required />
    <button className="btn">{reg ? 'Sign up' : 'Log in'}</button><button type="button" className="lk" onClick={() => setReg(!reg)}>{reg ? 'I already have an account' : 'Create an account'}</button></form></>
}

function Pic({ src, t }) { const [bad, setBad] = useState(!src); return bad ? <div className="ph">{(t || '?')[0]}</div> : <img loading="lazy" src={src} alt="" referrerPolicy="no-referrer" onError={() => setBad(true)} /> }