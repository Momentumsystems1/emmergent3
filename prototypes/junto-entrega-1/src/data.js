// Contactos de ejemplo para el prototipo. En la app real salen de la agenda del teléfono
// tras el permiso y se cruzan con el servidor mediante hash del número (no se guardan).
export const TIERS = {
  plan: { key: 'plan', label: 'En tu plan', short: 'Plan', color: '#CFF26B', perk: 'Todo incluido con tu plan' },
  app: { key: 'app', label: 'Ya usan Junto', short: 'App', color: '#67C6FF', perk: 'Entra con su app · puedes pasarle a tu plan' },
  web: { key: 'web', label: 'Sin app · se unen por enlace', short: 'Web', color: '#FFC452', perk: 'Acceso web limitado · se le invita a descargar gratis' },
}

export const PLAN = { name: 'Prueba Familia', days: 14, seats: 6 }

export const CONTACTS = [
  { id: 1, name: 'Marta Riera', sub: 'Pareja · comparte tu plan', tier: 'plan' },
  { id: 2, name: 'Leo Riera', sub: 'Hijo · comparte tu plan', tier: 'plan' },
  { id: 3, name: 'Carla Riera', sub: 'Hija · comparte tu plan', tier: 'plan' },
  { id: 4, name: 'Jordi Puig', sub: 'Plan Gratis', tier: 'app' },
  { id: 5, name: 'Núria Vidal', sub: 'Plan Familia', tier: 'app' },
  { id: 6, name: 'Pilar Ortega', sub: 'Plan Gratis', tier: 'app' },
  { id: 7, name: 'Andrés Molina', sub: '+34 6•• ••• 218', tier: 'web' },
  { id: 8, name: 'Lucía Ferrer', sub: '+34 6•• ••• 905', tier: 'web' },
  { id: 9, name: 'Pau Soler', sub: '+34 6•• ••• 374', tier: 'web' },
  { id: 10, name: 'Elena Martín', sub: '+34 6•• ••• 611', tier: 'web' },
  { id: 11, name: 'Iván Costa', sub: '+34 6•• ••• 052', tier: 'web' },
  { id: 12, name: 'Raquel Gil', sub: '+34 6•• ••• 487', tier: 'web' },
]

export const initials = (n) => n.split(' ').map((p) => p[0]).slice(0, 2).join('')
