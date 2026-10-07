import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { C, SEAT_COLORS } from './brand.jsx'
import { initials, TIERS } from './data.js'

function useSize(ref) {
  const [w, setW] = useState(320)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [ref])
  return w
}

// Reparte los asientos en uno o dos anillos según cuántos sean.
export function layout(n, w) {
  const R1 = w * 0.36, Rin = w * 0.235, Rout = w * 0.43
  const out = []
  if (n <= 6) {
    for (let i = 0; i < n; i++) out.push({ r: R1, a: -90 + (360 / n) * i, ring: 0 })
  } else {
    const inner = 3
    for (let i = 0; i < inner; i++) out.push({ r: Rin, a: -90 + (360 / inner) * i, ring: 1 })
    const o = n - inner
    for (let i = 0; i < o; i++) out.push({ r: Rout, a: -90 + 360 / o / 2 + (360 / o) * i, ring: 2 })
  }
  return out.map((p) => ({ ...p, x: Math.cos((p.a * Math.PI) / 180) * p.r, y: Math.sin((p.a * Math.PI) / 180) * p.r }))
}

function Burst({ color }) {
  return (
    <>
      {Array.from({ length: 9 }).map((_, i) => {
        const a = (i / 9) * Math.PI * 2
        return (
          <motion.span key={i}
            style={{ position: 'absolute', left: '50%', top: '50%', width: 6, height: 6, marginLeft: -3, marginTop: -3, borderRadius: 9, background: i % 3 === 0 ? C.paper : color, pointerEvents: 'none' }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(a) * 46, y: Math.sin(a) * 46, opacity: 0, scale: 0.3 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} />
        )
      })}
    </>
  )
}

/**
 * seats: [{ contact? }] — sin contacto muestra su número secuencial.
 * center: texto del núcleo (Tú / iniciales)
 */
export default function Orbit({ seats, center = 'Tú', collapsed = false, highlight = -1 }) {
  const ref = useRef(null)
  const w = useSize(ref)
  const n = seats.length
  const pos = layout(n, w)
  const rings = n <= 6 ? [w * 0.36] : [w * 0.235, w * 0.43]

  return (
    <div ref={ref} className="orbit-stage">
      {/* Anillos técnicos */}
      <svg viewBox={`0 0 ${w} ${w}`} width={w} height={w} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} fill="none">
        <circle cx={w / 2} cy={w / 2} r={w * 0.495} stroke={C.ink3} strokeWidth="1" strokeDasharray="1 5" />
        {rings.map((r, i) => (
          <motion.g key={`${n <= 6}-${i}`} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: collapsed ? 0 : 1, scale: collapsed ? 0.3 : 1 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} style={{ originX: `${w / 2}px`, originY: `${w / 2}px` }}>
            <circle cx={w / 2} cy={w / 2} r={r} stroke={C.ink4} strokeWidth="1.5" />
            <circle cx={w / 2} cy={w / 2} r={r} stroke={C.lime} strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray={`${r * 0.5} ${r * 6}`} className="orbit-spin" style={{ transformOrigin: 'center', transformBox: 'fill-box' }} />
          </motion.g>
        ))}
        {/* marcas de grado */}
        {Array.from({ length: 48 }).map((_, i) => {
          const a = (i / 48) * Math.PI * 2, r1 = w * 0.495, r2 = r1 - (i % 4 === 0 ? 8 : 4)
          return <line key={i} x1={w / 2 + Math.cos(a) * r1} y1={w / 2 + Math.sin(a) * r1} x2={w / 2 + Math.cos(a) * r2} y2={w / 2 + Math.sin(a) * r2} stroke={C.ink4} strokeWidth="1" />
        })}
        <text x={w / 2} y={14} textAnchor="middle" fill={C.muted} fontSize="10" fontFamily="Satoshi, system-ui, sans-serif" fontWeight="700" letterSpacing="2">{String(n).padStart(2, '0')} · ÓRBITA</text>
      </svg>

      {/* Asientos en órbita */}
      <div className="orbit-spin" style={{ animationDuration: '90s' }}>
        <AnimatePresence>
          {seats.map((s, i) => {
            const p = pos[i]
            const color = s.contact ? TIERS[s.contact.tier].color : SEAT_COLORS[i % SEAT_COLORS.length]
            return (
              <motion.div key={i} className="seat"
                initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                animate={collapsed ? { x: 0, y: 0, scale: 0.2, opacity: 0 } : { x: p.x, y: p.y, scale: 1, opacity: 1 }}
                exit={{ x: 0, y: 0, scale: 0, opacity: 0, transition: { duration: 0.25 } }}
                transition={{ type: 'spring', stiffness: 240, damping: 19, mass: 0.8, delay: collapsed ? i * 0.03 : 0 }}>
                <div className="counter-spin" style={{ animationDuration: '90s', width: '100%', height: '100%' }}>
                  <Burst color={color} />
                  <motion.div className="seat-face"
                    animate={{ scale: highlight === i ? 1.12 : 1 }}
                    style={s.contact
                      ? { background: C.ink3, color: C.paper, boxShadow: `0 0 0 2.5px ${color}`, fontSize: 16 }
                      : { background: color, boxShadow: `0 6px 22px ${color}44` }}>
                    {s.contact ? initials(s.contact.name) : i + 1}
                    {s.contact && <span className="badge" style={{ background: color }} />}
                  </motion.div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Núcleo */}
      <motion.div style={{ position: 'absolute', left: '50%', top: '50%', width: 78, height: 78, margin: '-39px 0 0 -39px' }}
        animate={{ scale: collapsed ? 1.25 : 1 }} transition={{ type: 'spring', stiffness: 200, damping: 16 }}>
        <motion.span style={{ position: 'absolute', inset: -10, borderRadius: 99, border: `1.5px solid ${C.lime}` }}
          animate={{ scale: [1, 1.35], opacity: [0.6, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }} />
        <div style={{ width: '100%', height: '100%', borderRadius: 99, background: C.lime, color: C.ink, display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: center.length > 3 ? 16 : 22, textAlign: 'center', lineHeight: 1.05, padding: 6 }}>
          {center}
        </div>
      </motion.div>
    </div>
  )
}
