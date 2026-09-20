// Product copy (Spanish). Function tree: only real, connected functions (no empty tools).
export const AVATAR_COLORS = ["#22D3EE", "#60A5FA", "#34D399", "#A78BFA", "#FBBF24", "#FB7185", "#F97316"];
export const SYMBOLS = ["pin", "shield", "car", "star", "heart"];

export const PERSON_ACTIONS = [
  { key: "estado", label: "Estado", icon: "pulse" },
  { key: "ir_hasta", label: "Ir hasta esta persona", icon: "navigate" },
  { key: "reunirse", label: "Reunirse", icon: "calendar" },
  { key: "seguir", label: "Seguir (Convoy)", icon: "footsteps" },
  { key: "todo_bien", label: "¿Todo bien?", icon: "help-circle" },
  { key: "incidencia", label: "Incidencia", icon: "warning" },
  { key: "mensaje", label: "Mensaje", icon: "chatbubble" },
  { key: "actividad", label: "Actividad reciente", icon: "list" },
  { key: "comparticion", label: "Compartición", icon: "share-social" },
];

export const ONBOARDING = {
  terms: {
    title: "Antes de empezar, ¿aceptas las condiciones de uso de MY CLUSTER?",
    body: "MY CLUSTER es una aplicación de movilidad y seguridad cuyas funciones dependen de los permisos que tú concedes de forma explícita.",
    primary: "Aceptar y continuar", secondary: "Leer condiciones completas",
  },
  data: {
    title: "¿Quieres saber cómo utiliza MY CLUSTER tus datos?",
    body: "Según los permisos que actives, distintas funciones pueden tratar tu ubicación actual o aproximada, rutas, ETA, estado de movimiento, modo de movilidad, eventos de seguridad, cámara, micrófono, información del dispositivo, eventos V16 y métricas de movilidad. El acceso depende siempre de permisos explícitos y de la compartición que configures.",
    primary: "Entendido", secondary: "Revisar información completa",
  },
  transparency: {
    title: "MY CLUSTER no utiliza funciones ocultas",
    body: "Siempre podrás saber qué está accediendo MY CLUSTER, qué comparte, con quién, por qué, desde cuándo y hasta cuándo.",
    bullets: ["Sin seguimiento oculto", "Sin activación oculta de la cámara", "Sin activación oculta del micrófono",
      "Sin acceso remoto invisible a cámaras", "Sin permisos temporales permanentes"],
    primary: "Entendido",
  },
  security: {
    title: "Protegemos tus datos y tus conexiones",
    body: "Comunicaciones cifradas cuando es técnicamente aplicable, sesiones autenticadas, permisos temporales y revocables, historial de accesos, expiración de sesión, tokens seguros y separación entre datos personales, de grupo y temporales.",
    primary: "Entendido", secondary: "Más información",
  },
};

export const EDUCATION = {
  miniorb: "Este es tu grupo. Tócalo para ver sus miembros y permisos.",
  privacy: "Aquí puedes ver exactamente qué compartes y con quién.",
};
