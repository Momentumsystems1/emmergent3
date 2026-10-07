import { motion } from 'framer-motion'

export const C = {
  ink: '#0D0F14', ink2: '#141821', ink3: '#1C212D', ink4: '#262C3A', paper: '#F3F0E8', muted: '#9AA1B0',
  lime: '#CFF26B', coral: '#FF6A4D', sky: '#67C6FF', amber: '#FFC452', rose: '#FF7EB3', mint: '#5EE0B5', lilac: '#A99BFF',
}
export const SEAT_COLORS = [C.coral, C.sky, C.amber, C.rose, C.mint, C.lilac, C.lime, '#FF9F5A']

/* Marca: una órbita y dos puntos — tú en el centro, los tuyos en movimiento. */
export function Mark({ size = 40, animated = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-label="Junto">
      <ellipse cx="24" cy="24" rx="19" ry="11" transform="rotate(-28 24 24)" stroke={C.lime} strokeWidth="3.4" />
      <circle cx="24" cy="24" r="6" fill={C.paper} />
      {animated ? (
        <g><animateTransform attributeName="transform" type="rotate" from="0 24 24" to="360 24 24" dur="6s" repeatCount="indefinite" /><circle cx="40" cy="15.5" r="4.6" fill={C.coral} /></g>
      ) : (
        <circle cx="40" cy="15.5" r="4.6" fill={C.coral} />
      )}
    </svg>
  )
}

export function Wordmark({ size = 28 }) {
  return (
    <div className="wordmark" style={{ display: 'flex', alignItems: 'center', gap: size * 0.32 }}>
      <Mark size={size * 1.25} />
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: size, letterSpacing: '-0.035em', lineHeight: 1 }}>junto</span>
    </div>
  )
}

/* ---------------- Ilustraciones del onboarding (2D, paleta de marca) ---------------- */

const float = (d = 0) => ({ animate: { y: [0, -6, 0] }, transition: { duration: 4, repeat: Infinity, ease: 'easeInOut', delay: d } })

/* 1 · "Tu gente, a la vista": casa en el centro y los suyos llegando por sus órbitas */
export function IlluNear() {
  return (
    <svg viewBox="0 0 300 300" width="100%" height="100%" fill="none">
      <circle cx="150" cy="150" r="128" stroke={C.ink4} strokeWidth="1.5" strokeDasharray="2 7" />
      <circle cx="150" cy="150" r="88" stroke={C.ink4} strokeWidth="1.5" />
      <g><animateTransform attributeName="transform" type="rotate" from="0 150 150" to="360 150 150" dur="26s" repeatCount="indefinite" />
        <circle cx="150" cy="22" r="13" fill={C.sky} />
        <circle cx="261" cy="214" r="10" fill={C.amber} />
      </g>
      <g><animateTransform attributeName="transform" type="rotate" from="0 150 150" to="-360 150 150" dur="18s" repeatCount="indefinite" />
        <circle cx="88" cy="88" r="11" fill={C.rose} />
      </g>
      {/* casa */}
      <rect x="112" y="128" width="76" height="62" rx="14" fill={C.paper} />
      <path d="M104 136 L150 98 L196 136" stroke={C.paper} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="140" y="156" width="20" height="34" rx="6" fill={C.ink} />
      {/* llegada con check */}
      <motion.g {...float(0.4)}>
        <circle cx="206" cy="112" r="20" fill={C.lime} />
        <path d="M197 112 l6 6 l12 -13" stroke={C.ink} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
    </svg>
  )
}

/* 2 · "Moveos como uno": varios coches, una sola línea hacia la meta */
function Car({ x, y, color, rot = 0, lead }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x="-22" y="-13" width="44" height="26" rx="10" fill={color} />
      <rect x="-6" y="-9" width="14" height="18" rx="4" fill={C.ink} opacity="0.85" />
      {lead && <circle cx="-16" cy="0" r="3" fill={C.ink} />}
    </g>
  )
}
export function IlluCo() {
  const road = 'M30 250 C 90 250, 90 170, 150 160 S 230 80, 262 52'
  return (
    <svg viewBox="0 0 300 300" width="100%" height="100%" fill="none">
      <path d={road} stroke={C.ink3} strokeWidth="34" strokeLinecap="round" />
      <motion.path d={road} stroke={C.lime} strokeWidth="3" strokeLinecap="round" strokeDasharray="6 10" animate={{ strokeDashoffset: [0, -64] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }} />
      {/* meta */}
      <g transform="translate(250 30)">
        <path d="M6 0 V44" stroke={C.paper} strokeWidth="4" strokeLinecap="round" />
        <path d="M8 2 H36 L28 12 L36 22 H8 Z" fill={C.coral} />
      </g>
      <motion.g {...float(0)}><Car x={206} y={104} color={C.paper} rot={-45} lead /></motion.g>
      <motion.g {...float(0.3)}><Car x={150} y={160} color={C.sky} rot={-20} /></motion.g>
      <motion.g {...float(0.6)}><Car x={86} y={226} color={C.amber} rot={-40} /></motion.g>
      {/* ETA conjunta */}
      <g transform="translate(26 54)">
        <rect width="104" height="50" rx="16" fill={C.ink2} stroke={C.ink4} />
        <text x="16" y="21" fill={C.muted} fontSize="11" fontFamily="Satoshi, system-ui, sans-serif" fontWeight="700" letterSpacing="1">ETA GRUPO</text>
        <text x="16" y="40" fill={C.paper} fontSize="18" fontFamily="Cabinet Grotesk, Satoshi, system-ui, sans-serif" fontWeight="800">18:42</text>
      </g>
    </svg>
  )
}

/* 3 · "Tú decides qué se ve": interruptores, uno apagado — control real */
export function IlluPrivacy() {
  const rows = [
    { y: 92, c: C.coral, on: true },
    { y: 146, c: C.sky, on: false },
    { y: 200, c: C.amber, on: true },
  ]
  return (
    <svg viewBox="0 0 300 300" width="100%" height="100%" fill="none">
      <rect x="54" y="52" width="192" height="196" rx="30" fill={C.ink2} stroke={C.ink4} />
      {rows.map((r, i) => (
        <g key={i}>
          <circle cx="92" cy={r.y + 12} r="14" fill={r.c} opacity={r.on ? 1 : 0.35} />
          <rect x="116" y={r.y + 6} width="54" height="12" rx="6" fill={C.ink4} />
          <motion.g initial={false} animate={{ x: 0 }}>
            <rect x="182" y={r.y} width="44" height="24" rx="12" fill={r.on ? C.lime : C.ink4} />
            <motion.circle cy={r.y + 12} r="9" fill={r.on ? C.ink : C.paper}
              animate={{ cx: r.on ? [194, 214, 214] : [214, 194, 194] }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 1.2, delay: i * 0.4 }} />
          </motion.g>
        </g>
      ))}
      <motion.g {...float(0.2)}>
        <path d="M230 30 l28 10 v18 c0 18 -12 30 -28 36 c-16 -6 -28 -18 -28 -36 v-18 z" fill={C.lime} />
        <path d="M219 61 l8 8 l14 -15" stroke={C.ink} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
    </svg>
  )
}

/* 4 · "Cada viaje suma": hoja + justificante trazable */
export function IlluImpact() {
  return (
    <svg viewBox="0 0 300 300" width="100%" height="100%" fill="none">
      <g transform="translate(70 46)">
        <path d="M0 14 C0 6 6 0 14 0 H146 C154 0 160 6 160 14 V206 L144 196 L128 206 L112 196 L96 206 L80 196 L64 206 L48 196 L32 206 L16 196 L0 206 Z" fill={C.paper} />
        <text x="18" y="34" fill={C.ink} fontSize="11" fontFamily="Satoshi, system-ui, sans-serif" fontWeight="700" letterSpacing="1">REF · JT-2610-0042</text>
        <rect x="18" y="48" width="96" height="8" rx="4" fill="#D9D5CA" />
        <rect x="18" y="64" width="70" height="8" rx="4" fill="#D9D5CA" />
        <text x="18" y="124" fill={C.ink} fontSize="34" fontFamily="Cabinet Grotesk, Satoshi, system-ui, sans-serif" fontWeight="800">−2,4 kg</text>
        <text x="18" y="144" fill="#6B7282" fontSize="12" fontFamily="Satoshi, system-ui, sans-serif" fontWeight="700">CO₂ evitado</text>
        <g transform="translate(18 162)">
          {Array.from({ length: 12 }).map((_, i) => <rect key={i} x={i * 10} y="0" width={i % 3 ? 4 : 7} height="18" fill={C.ink} />)}
        </g>
      </g>
      <motion.g {...float(0.3)} >
        <path d="M232 58 C 268 58 276 96 262 120 C 236 122 214 104 214 80 C 214 66 222 58 232 58 Z" fill={C.lime} />
        <path d="M262 120 C 246 104 236 90 228 72" stroke={C.ink} strokeWidth="3.5" strokeLinecap="round" />
      </motion.g>
    </svg>
  )
}
