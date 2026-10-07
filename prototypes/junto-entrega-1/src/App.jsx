import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { C, Mark, Wordmark, IlluNear, IlluCo, IlluPrivacy, IlluImpact } from './brand.jsx'
import Orbit from './Orbit.jsx'
import { CONTACTS, PLAN, TIERS, initials } from './data.js'

const ease = [0.16, 1, 0.3, 1]
const STEPS = ['welcome', 'intro', 'account', 'setup', 'group', 'contacts', 'done', 'end']
const NOTES = {
  welcome: ['Bienvenida', 'Una sola idea: tú en el centro y los tuyos en órbita. Claim corto, un botón. Nada más compite por la atención.'],
  intro: ['Onboarding', 'Cuatro pantallas, una idea cada una. La ilustración cuenta el título antes de leerlo; el texto se queda en una línea.'],
  account: ['Cuenta', 'Solo nombre y móvil. El móvil es la llave para que tus contactos te encuentren, igual que en WhatsApp.'],
  setup: ['Configuración automática', 'Un toque lo deja todo listo con valores prudentes. "Puedes modificarlas cuando quieras" quita el miedo a equivocarse.'],
  group: ['Grupo orbital', 'Teclea cuántos sois y entran en órbita, numerados. El número evita contar: si ves un 5, has puesto cinco.'],
  contacts: ['Contactos en tres niveles', 'Verde lima: en tu plan. Azul: ya usan Junto. Ámbar: entran por enlace web con funciones limitadas.'],
  done: ['Grupo listo', 'La órbita se comprime en el átomo del grupo. Cada persona sabe qué recibe y por qué.'],
  end: ['Siguiente entrega', 'Mapa y Co-movilidad: Modo Guía y Modo Destino, ETA conjunta, referencia trazable y wallet.'],
}

/* ---------- iconos ---------- */
const I = {
  back: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  check: (c = 'currentColor', s = 14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke={c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  search: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  link: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>,
  bolt: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="currentColor" /></svg>,
  chat: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 20l1.4-4A8 8 0 1 1 8.6 19L4 20z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>,
}

function Screen({ children, k }) {
  return (
    <motion.div key={k} className="view" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.45, ease }}>
      {children}
    </motion.div>
  )
}

/* ================= 1 · Bienvenida ================= */
function Welcome({ next }) {
  const dots = [C.coral, C.sky, C.amber, C.rose, C.mint]
  return (
    <Screen k="welcome">
      <Wordmark size={26} />
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', position: 'relative' }}>
        <svg viewBox="0 0 320 320" width="100%" style={{ maxWidth: 320 }} fill="none" aria-hidden>
          {[150, 112, 74].map((r, i) => (
            <circle key={r} cx="160" cy="160" r={r} stroke={C.ink3} strokeWidth="1.5" strokeDasharray={i === 0 ? '2 6' : undefined} />
          ))}
          {dots.map((c, i) => {
            const r = [150, 112, 74, 112, 150][i]
            const dir = i % 2 ? -1 : 1
            return (
              <g key={i}>
                <animateTransform attributeName="transform" type="rotate" from={`${i * 72} 160 160`} to={`${i * 72 + dir * 360} 160 160`} dur={`${20 + i * 6}s`} repeatCount="indefinite" />
                <motion.circle cx="160" cy={160 - r} r={[11, 9, 8, 7, 10][i]} fill={c} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 + i * 0.12, type: 'spring' }} />
              </g>
            )
          })}
          <motion.circle cx="160" cy="160" r="34" fill={C.lime} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 180, damping: 14 }} />
          <motion.circle cx="160" cy="160" r="34" stroke={C.lime} strokeWidth="2" animate={{ r: [34, 70], opacity: [0.5, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }} />
        </svg>
      </div>
      <motion.h1 className="h1" style={{ fontSize: 44 }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6, ease }}>
        Juntos,<br />se llega <span style={{ color: C.lime }}>mejor.</span>
      </motion.h1>
      <motion.p className="lead" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        Los tuyos cerca. Cada trayecto, más limpio.
      </motion.p>
      <div style={{ marginTop: 28, display: 'grid', gap: 6 }}>
        <button className="btn btn-primary" onClick={next}>Empezar</button>
        <button className="btn btn-text">Ya tengo cuenta</button>
      </div>
    </Screen>
  )
}

/* ================= 2 · Onboarding ================= */
const SLIDES = [
  { art: IlluNear, t: 'Tu gente, a la vista.', s: 'Sabes que han llegado sin preguntar.' },
  { art: IlluCo, t: 'Moveos como uno.', s: 'Varios coches, un solo plan y una hora de llegada.' },
  { art: IlluPrivacy, t: 'Tú decides qué se ve.', s: 'Compartes solo lo que eliges, con quien eliges.' },
  { art: IlluImpact, t: 'Cada viaje suma.', s: 'Menos coches, menos CO₂. Y queda demostrado.' },
]
function Intro({ next, back }) {
  const [i, setI] = useState(0)
  const S = SLIDES[i]
  const go = (d) => { const n = i + d; if (n < 0) return back(); if (n >= SLIDES.length) return next(); setI(n) }
  return (
    <Screen k="intro">
      <div className="topbar">
        <button className="icon-btn" onClick={() => go(-1)} aria-label="Atrás">{I.back}</button>
        <button className="skip" onClick={next}>Saltar</button>
      </div>
      <motion.div style={{ flex: 1, display: 'flex', flexDirection: 'column' }} drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.2}
        onDragEnd={(_, info) => { if (info.offset.x < -60) go(1); if (info.offset.x > 60) go(-1) }}>
        <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
          <AnimatePresence mode="wait">
            <motion.div key={i} style={{ width: '100%', maxWidth: 300, aspectRatio: '1' }} initial={{ opacity: 0, scale: 0.9, rotate: -4 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.45, ease }}>
              <S.art />
            </motion.div>
          </AnimatePresence>
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease }} style={{ minHeight: 120 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>{String(i + 1).padStart(2, '0')} / 04</div>
            <h2 className="h1">{S.t}</h2>
            <p className="lead">{S.s}</p>
          </motion.div>
        </AnimatePresence>
      </motion.div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, gap: 16 }}>
        <div className="dots">{SLIDES.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>
        <button className="btn btn-primary" style={{ width: i === 3 ? 180 : 140, transition: 'width 300ms' }} onClick={() => go(1)}>
          {i === 3 ? 'Crear cuenta' : 'Siguiente'}
        </button>
      </div>
    </Screen>
  )
}

/* ================= 3 · Cuenta ================= */
function Account({ next, back, user, setUser }) {
  const ok = user.name.trim().length >= 2 && user.phone.replace(/\D/g, '').length >= 9
  return (
    <Screen k="account">
      <div className="topbar"><button className="icon-btn" onClick={back} aria-label="Atrás">{I.back}</button><span /></div>
      <h1 className="h1" style={{ marginTop: 12 }}>Hola.<br />¿Quién eres?</h1>
      <p className="lead">Con tu móvil, los tuyos te encuentran.</p>
      <div style={{ display: 'grid', gap: 18, marginTop: 30 }}>
        <div className="field">
          <label htmlFor="n">Nombre</label>
          <input id="n" className="input" placeholder="Juan" autoComplete="given-name" value={user.name} onChange={(e) => setUser({ ...user, name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="p">Móvil</label>
          <div className="phone-input">
            <div className="prefix">🇪🇸 +34</div>
            <input id="p" className="input" style={{ flex: 1, minWidth: 0 }} placeholder="600 000 000" inputMode="tel" autoComplete="tel-national" value={user.phone}
              onChange={(e) => setUser({ ...user, phone: e.target.value.replace(/[^\d ]/g, '').slice(0, 11) })} />
          </div>
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <p className="small" style={{ textAlign: 'center', marginBottom: 14 }}>Al continuar aceptas los <u>Términos</u> y la <u>Privacidad</u>.</p>
      <button className="btn btn-primary" disabled={!ok} onClick={next}>Continuar</button>
    </Screen>
  )
}

/* ================= 4 · Configuración automática ================= */
const SETTINGS = [
  { k: 'loc', c: C.coral, t: 'Ubicación solo con tu grupo', s: 'Nadie más la ve.' },
  { k: 'arr', c: C.sky, t: 'Avisos de llegada', s: 'Casa, cole y trabajo, solos.' },
  { k: 'bat', c: C.amber, t: 'Ahorro de batería', s: 'Precisión alta solo en marcha.' },
  { k: 'co2', c: C.lime, t: 'Huella de movilidad', s: 'Cuenta el CO₂ que evitáis.' },
]
function Setup({ next, back }) {
  const [manual, setManual] = useState(false)
  const [vals, setVals] = useState({ loc: true, arr: true, bat: true, co2: true })
  const [done, setDone] = useState(-1)
  const auto = () => {
    SETTINGS.forEach((_, i) => setTimeout(() => setDone(i), 160 + i * 230))
    setTimeout(next, 160 + SETTINGS.length * 230 + 420)
  }
  return (
    <Screen k="setup">
      <div className="topbar"><button className="icon-btn" onClick={back} aria-label="Atrás">{I.back}</button><span /></div>
      <h1 className="h1" style={{ marginTop: 12 }}>Lo dejamos<br />listo por ti.</h1>
      <p className="lead">Valores prudentes, pensados para familias.</p>
      <div className="card" style={{ marginTop: 26, padding: '6px 18px' }}>
        {SETTINGS.map((s, i) => (
          <div key={s.k} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: i < 3 ? '1px solid var(--line)' : 0 }}>
            <motion.span style={{ width: 34, height: 34, borderRadius: 99, display: 'grid', placeItems: 'center', flexShrink: 0 }}
              animate={{ background: done >= i ? s.c : C.ink3, scale: done === i ? [1, 1.2, 1] : 1 }} transition={{ duration: 0.3 }}>
              {done >= i ? I.check(C.ink, 16) : <i style={{ width: 10, height: 10, borderRadius: 9, background: s.c }} />}
            </motion.span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{s.t}</div>
              <div className="small">{s.s}</div>
            </div>
            {manual && <button className={`toggle ${vals[s.k] ? 'on' : ''}`} aria-label={s.t} aria-pressed={vals[s.k]} onClick={() => setVals({ ...vals, [s.k]: !vals[s.k] })} />}
          </div>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      {manual ? (
        <button className="btn btn-primary" onClick={next}>Guardar y seguir</button>
      ) : (
        <button className="btn btn-primary" onClick={auto} disabled={done >= 0}>{I.bolt} Configurar automáticamente</button>
      )}
      <p className="small" style={{ textAlign: 'center', marginTop: 12 }}>Puedes modificarlas cuando quieras.</p>
      {!manual && <button className="btn btn-text" onClick={() => setManual(true)}>Prefiero elegir yo</button>}
    </Screen>
  )
}

/* ================= 5 · Grupo orbital ================= */
const NAMES = ['Familia', 'Amigos', 'Trabajo', 'Viaje']
function Group({ next, back, group, setGroup }) {
  const { count } = group
  const setCount = (v) => setGroup({ ...group, count: Math.max(1, Math.min(12, v || 1)) })
  const seats = useMemo(() => Array.from({ length: count }, () => ({})), [count])
  const overPlan = count + 1 > PLAN.seats
  return (
    <Screen k="group">
      <div className="topbar"><button className="icon-btn" onClick={back} aria-label="Atrás">{I.back}</button><span className="eyebrow">Nuevo grupo</span><span style={{ width: 40 }} /></div>
      <input className="h2" aria-label="Nombre del grupo" value={group.name} onChange={(e) => setGroup({ ...group, name: e.target.value })}
        style={{ background: 'none', border: 0, outline: 'none', width: '100%', marginTop: 4 }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto' }}>
        {NAMES.map((n) => <button key={n} className={`chip ${group.name.startsWith(n) ? 'on' : ''}`} onClick={() => setGroup({ ...group, name: n })}>{n}</button>)}
      </div>
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', minHeight: 0 }}>
        <Orbit seats={seats} />
      </div>
      <div className="num-control">
        <button className="num-btn" onClick={() => setCount(count - 1)} aria-label="Una persona menos">−</button>
        <input className="num-input" type="number" inputMode="numeric" min={1} max={12} value={count} aria-label="Personas además de ti"
          onFocus={(e) => e.target.select()} onChange={(e) => setCount(parseInt(e.target.value.slice(-2), 10))} />
        <button className="num-btn" onClick={() => setCount(count + 1)} aria-label="Una persona más">+</button>
      </div>
      <p className="small" style={{ textAlign: 'center', marginTop: 10, minHeight: 38 }}>
        {overPlan
          ? <>Tu prueba incluye {PLAN.seats} plazas. El resto entra con su app o por enlace.</>
          : <>¿Cuántos sois además de ti?</>}
      </p>
      <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={next}>Elegir quiénes son</button>
    </Screen>
  )
}

/* ================= 6 · Contactos ================= */
function Avatar({ c, size = 44 }) {
  const t = TIERS[c.tier]
  return (
    <div className="avatar" style={{ width: size, height: size, background: c.tier === 'plan' ? t.color : C.ink3, color: c.tier === 'plan' ? C.ink : C.paper, boxShadow: c.tier === 'plan' ? 'none' : `inset 0 0 0 2px ${t.color}` }}>
      {initials(c.name)}
      {c.tier === 'app' && <span style={{ position: 'absolute', right: -2, bottom: -2, width: 18, height: 18, borderRadius: 99, background: C.ink, display: 'grid', placeItems: 'center' }}><Mark size={14} /></span>}
      {c.tier === 'web' && <span style={{ position: 'absolute', right: -2, bottom: -2, width: 18, height: 18, borderRadius: 99, background: t.color, color: C.ink, display: 'grid', placeItems: 'center', border: `2px solid ${C.ink}` }}>{I.link}</span>}
    </div>
  )
}

function Contacts({ next, back, group, picked, setPicked }) {
  const [perm, setPerm] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [q, setQ] = useState('')
  const [f, setF] = useState('all')
  const n = group.count
  const nextSlot = picked.findIndex((p) => !p)
  const planUsed = 1 + picked.filter((p) => p && p.tier === 'plan').length

  const toggle = (c) => {
    const idx = picked.findIndex((p) => p && p.id === c.id)
    const copy = [...picked]
    if (idx >= 0) copy[idx] = null
    else if (nextSlot >= 0) copy[nextSlot] = c
    else return
    setPicked(copy)
  }
  const list = CONTACTS.filter((c) => (f === 'all' || c.tier === f) && c.name.toLowerCase().includes(q.toLowerCase()))
  const filled = picked.filter(Boolean).length

  return (
    <Screen k="contacts">
      <div className="topbar"><button className="icon-btn" onClick={back} aria-label="Atrás">{I.back}</button><span className="eyebrow">{group.name}</span><span style={{ width: 40 }} /></div>
      <h1 className="h2">¿Quiénes son?</h1>

      <div className="slots" style={{ marginTop: 14 }}>
        {picked.map((p, i) => {
          const t = p && TIERS[p.tier]
          return (
            <button key={i} className="slot" onClick={() => p && toggle(p)} aria-label={p ? `Quitar a ${p.name}` : `Plaza ${i + 1} libre`}>
              <motion.div className={`face ${p ? '' : 'empty'} ${i === nextSlot ? 'next' : ''}`} layout
                style={p ? { background: p.tier === 'plan' ? t.color : C.ink3, color: p.tier === 'plan' ? C.ink : C.paper, boxShadow: p.tier === 'plan' ? 'none' : `inset 0 0 0 2px ${t.color}` } : {}}
                initial={false} animate={{ scale: p ? [0.8, 1.08, 1] : 1 }} transition={{ duration: 0.35 }}>
                {p ? initials(p.name) : i + 1}
              </motion.div>
              <span style={{ maxWidth: 46, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p ? p.name.split(' ')[0] : `Nº ${i + 1}`}</span>
            </button>
          )
        })}
      </div>

      {perm && (
        <>
          <div className="search">{I.search}<input placeholder="Buscar en tu agenda" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" /></div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {[['all', 'Todos'], ['plan', 'Plan'], ['app', 'Con Junto'], ['web', 'Sin app']].map(([k, l]) => (
              <button key={k} className={`chip ${f === k ? 'on' : ''}`} style={{ height: 32, fontSize: 13 }} onClick={() => setF(k)}>
                {k !== 'all' && <i style={{ width: 7, height: 7, borderRadius: 9, background: TIERS[k].color }} />}{l}
              </button>
            ))}
          </div>
          <div className="list" style={{ marginTop: 4 }}>
            {['plan', 'app', 'web'].map((tk) => {
              const items = list.filter((c) => c.tier === tk)
              if (!items.length) return null
              const t = TIERS[tk]
              return (
                <div key={tk}>
                  <div className="section-h"><i style={{ background: t.color }} />{t.label}
                    {tk === 'plan' && <span style={{ marginLeft: 'auto', letterSpacing: 0, textTransform: 'none', fontWeight: 500 }}>{planUsed}/{PLAN.seats} plazas</span>}
                  </div>
                  {tk === 'web' && (
                    <p className="small" style={{ marginBottom: 4 }}>Recibirán un enlace. Entran desde el navegador con funciones básicas.</p>
                  )}
                  {items.map((c) => {
                    const slot = picked.findIndex((p) => p && p.id === c.id)
                    return (
                      <motion.button key={c.id} className="row" onClick={() => toggle(c)} whileTap={{ scale: 0.98 }} layout>
                        <Avatar c={c} />
                        <div className="meta"><div className="name">{c.name}</div><div className="sub">{c.sub}</div></div>
                        <span className="pick" style={slot >= 0 ? { background: t.color, borderColor: t.color, color: C.ink } : {}}>{slot >= 0 ? slot + 1 : ''}</span>
                      </motion.button>
                    )
                  })}
                </div>
              )
            })}
          </div>
          <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={!filled} onClick={next}>
            {filled === n ? 'Listo' : 'Continuar'} · {filled}/{n}
          </button>
        </>
      )}

      {!perm && (
        <>
          <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
            <div style={{ display: 'grid', gap: 12, width: '100%' }}>
              {['plan', 'app', 'web'].map((tk, i) => (
                <motion.div key={tk} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14 }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.1 }}>
                  <Avatar c={{ name: ['M R', 'J P', 'A M'][i], tier: tk }} size={40} />
                  <div><div style={{ fontWeight: 700, fontSize: 15 }}>{TIERS[tk].label}</div><div className="small">{TIERS[tk].perk}</div></div>
                </motion.div>
              ))}
            </div>
          </div>
          <div className="card" style={{ padding: 20, marginBottom: 4 }}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Abre tu agenda</div>
            <p className="small">Vemos quién ya usa Junto comparando los números cifrados. No guardamos los de quien no la usa.</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={scanning}
              onClick={() => { setScanning(true); setTimeout(() => setPerm(true), 900) }}>
              {scanning ? 'Buscando a los tuyos…' : 'Abrir contactos'}
            </button>
          </div>
        </>
      )}
    </Screen>
  )
}

/* ================= 7 · Grupo listo ================= */
function Done({ next, group, picked, user }) {
  const [phase, setPhase] = useState(0) // 0 órbita · 1 colapso
  const [sheet, setSheet] = useState(false)
  const [toast, setToast] = useState('')
  useEffect(() => { const t = setTimeout(() => setPhase(1), 1600); return () => clearTimeout(t) }, [])
  const members = picked.filter(Boolean)
  const by = (k) => members.filter((m) => m.tier === k)
  const seats = picked.map((p) => ({ contact: p || undefined }))
  const invite = () => { setToast(`Se abre WhatsApp: ${by('app').length + by('web').length} invitaciones, una a una`); setTimeout(() => setToast(''), 2600) }

  return (
    <Screen k="done">
      <div style={{ height: 310, marginTop: 6, display: 'grid', placeItems: 'center', position: 'relative' }}>
        <div style={{ width: 280 }}><Orbit seats={seats} center={phase ? group.name.slice(0, 7) : (user.name ? initials(user.name) : 'Tú')} collapsed={phase === 1} /></div>
        <AnimatePresence>
          {phase === 1 && (
            <motion.div style={{ position: 'absolute', bottom: 18, display: 'flex' }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              {members.slice(0, 6).map((m, i) => (
                <motion.div key={m.id} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5 + i * 0.06, type: 'spring' }} style={{ marginLeft: i ? -10 : 0 }}>
                  <Avatar c={m} size={34} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <h1 className="h1">{group.name} ya<br />está en órbita.</h1>
      <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
        {['plan', 'app', 'web'].map((k) => {
          const list = by(k); if (!list.length) return null
          return (
            <div key={k} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span className="tag" style={{ background: TIERS[k].color, color: C.ink, minWidth: 34, textAlign: 'center' }}>{list.length}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{list.map((m) => m.name.split(' ')[0]).join(', ')}</div>
                <div className="small">{TIERS[k].perk}</div>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ flex: 1 }} />
      <button className="btn btn-primary" onClick={invite}>{I.chat} Enviar invitaciones</button>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="btn btn-ghost" style={{ height: 50, fontSize: 14 }} onClick={() => setSheet(true)}>Vista invitado web</button>
        <button className="btn btn-ghost" style={{ height: 50, fontSize: 14 }} onClick={next}>Ir al mapa</button>
      </div>

      <AnimatePresence>
        {toast && <motion.div className="toast" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{toast}</motion.div>}
        {sheet && (
          <>
            <motion.div className="sheet-backdrop" onClick={() => setSheet(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.div className="sheet" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 260, damping: 30 }}>
              <div className="grabber" />
              <div className="eyebrow" style={{ marginBottom: 12 }}>Así lo ve quien entra por enlace</div>
              <div style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid var(--line-2)' }}>
                <div style={{ background: C.ink3, padding: '8px 12px', fontSize: 12, color: C.muted, display: 'flex', gap: 6, alignItems: 'center' }}>{I.link} junto.app/g/fam-riera</div>
                <div style={{ padding: 18, background: C.ink }}>
                  <Wordmark size={18} />
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, marginTop: 14, lineHeight: 1.1 }}>{user.name || 'Juan'} te invita a {group.name}.</div>
                  <ul style={{ listStyle: 'none', marginTop: 12, display: 'grid', gap: 8, fontSize: 14 }}>
                    <li style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{I.check(C.lime)} Ver al grupo en el mapa</li>
                    <li style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{I.check(C.lime)} Unirte a una Co-movilidad</li>
                    <li style={{ display: 'flex', gap: 8, alignItems: 'center', color: C.muted }}><span style={{ width: 14, textAlign: 'center' }}>–</span> Avisos, cercas y SOS solo en la app</li>
                  </ul>
                  <div style={{ marginTop: 16, padding: 14, borderRadius: 16, background: C.amber, color: C.ink }}>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>Descarga Junto gratis</div>
                    <div style={{ fontSize: 13, marginTop: 2 }}>Y disfruta de todo con tu grupo.</div>
                  </div>
                  <button className="btn btn-ghost" style={{ marginTop: 10, height: 48, fontSize: 14 }}>Seguir en la web</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </Screen>
  )
}

/* ================= Fin del prototipo ================= */
function End({ restart }) {
  return (
    <Screen k="end">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ width: 200, alignSelf: 'center' }}><IlluCo /></div>
        <div className="eyebrow" style={{ marginTop: 20 }}>Próxima entrega</div>
        <h1 className="h1" style={{ marginTop: 8 }}>Mapa y<br />Co-movilidad.</h1>
        <p className="lead">Modo Guía y Modo Destino, ETA conjunta, referencia trazable y wallet del grupo.</p>
      </div>
      <button className="btn btn-ghost" onClick={restart}>Ver de nuevo desde el principio</button>
    </Screen>
  )
}

/* ================= Shell ================= */
export default function App() {
  const [step, setStep] = useState(0)
  const [user, setUser] = useState({ name: '', phone: '' })
  const [group, setGroup] = useState({ name: 'Familia', count: 4 })
  const [picked, setPicked] = useState([])
  useEffect(() => {
    setPicked((p) => Array.from({ length: group.count }, (_, i) => p[i] || null))
  }, [group.count])

  const go = (s) => setStep(Math.max(0, Math.min(STEPS.length - 1, s)))
  const next = () => go(step + 1), back = () => go(step - 1)
  const key = STEPS[step]
  const jump = (i) => {
    if (i >= 3 && !user.name) setUser({ name: 'Juan', phone: '600 123 456' })
    if (i >= 6 && !picked.some(Boolean)) setPicked(Array.from({ length: group.count }, (_, k) => CONTACTS[[0, 1, 3, 6, 2, 8, 4, 9, 5, 10, 7, 11][k]] || null))
    go(i)
  }

  const now = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  return (
    <div className="stage">
      <aside className="brief">
        <Wordmark size={30} />
        <h2>Juntos, se llega mejor.</h2>
        <p>Prototipo navegable de la primera entrega: marca, bienvenida, onboarding, grupo orbital y contactos por niveles.</p>
        <div className="step-label">{String(step + 1).padStart(2, '0')} · {NOTES[key][0]}</div>
        <p className="note">{NOTES[key][1]}</p>
        <div className="jump">
          {['Bienvenida', 'Onboarding', 'Cuenta', 'Ajustes', 'Grupo', 'Contactos', 'Listo', 'Próximo'].map((l, i) => <button key={l} className={i === step ? 'on' : ''} onClick={() => jump(i)}>{l}</button>)}
        </div>
        <div className="swatches">
          {[['#0D0F14', 'Noche'], ['#F3F0E8', 'Papel'], ['#CFF26B', 'Brote'], ['#FF6A4D', 'Latido'], ['#67C6FF', 'Cielo'], ['#FFC452', 'Ámbar']].map(([c, n]) => (
            <div key={c} className="swatch"><i style={{ background: c }} />{n}</div>
          ))}
        </div>
      </aside>
      <div className="phone">
        <div className="screen">
          <div className="notch" />
          <div className="statusbar"><span>{now}</span><span style={{ letterSpacing: 2 }}>●●● ▮</span></div>
          <AnimatePresence mode="wait">
            {key === 'welcome' && <Welcome key="w" next={next} />}
            {key === 'intro' && <Intro key="i" next={next} back={back} />}
            {key === 'account' && <Account key="a" next={next} back={back} user={user} setUser={setUser} />}
            {key === 'setup' && <Setup key="s" next={next} back={back} />}
            {key === 'group' && <Group key="g" next={next} back={back} group={group} setGroup={setGroup} />}
            {key === 'contacts' && <Contacts key="c" next={next} back={back} group={group} picked={picked} setPicked={setPicked} />}
            {key === 'done' && <Done key="d" next={next} group={group} picked={picked} user={user} />}
            {key === 'end' && <End key="e" restart={() => { setStep(0); setPicked(Array(group.count).fill(null)) }} />}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
