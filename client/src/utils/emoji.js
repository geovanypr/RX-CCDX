// Catálogo de emojis y utilidades de inserción para los canales de chat.
// Cada entrada es [emoji, palabras clave] para que el buscador encuentre el símbolo.
// No se usa ninguna dependencia externa: el emoji se guarda como texto en SQLite.

export const EMOJI_RECIENTES_KEY = 'rxccdx_emoji_recientes';

export const EMOJI_GRUPOS = [
  {
    id: 'frecuentes',
    label: 'Frecuentes',
    emojis: [
      ['👍', 'ok bien listo aprobar pulgar'],
      ['👌', 'ok perfecto'],
      ['🙏', 'gracias por favor'],
      ['✅', 'listo hecho conforme'],
      ['❌', 'no error'],
      ['⚠️', 'atencion alerta cuidado'],
      ['🔴', 'urgente rojo critico'],
      ['⏰', 'hora tiempo pendiente'],
      ['📌', 'fijar importante nota'],
      ['📎', 'adjunto archivo'],
      ['📄', 'documento informe'],
      ['🖼️', 'imagen radiografia placa'],
      ['🔍', 'buscar revisar detalle'],
      ['💬', 'mensaje comentario'],
      ['🤝', 'acuerdo trato'],
      ['🎉', 'felicidades celebracion'],
      ['💪', 'animo fuerza'],
      ['👋', 'hola saludo'],
    ],
  },
  {
    id: 'caras',
    label: 'Caras',
    emojis: [
      ['😀', 'feliz sonrisa'],
      ['😃', 'feliz alegre'],
      ['😄', 'risa feliz'],
      ['😁', 'sonrisa'],
      ['😆', 'risa'],
      ['😅', 'risa nervios'],
      ['😂', 'risa llanto'],
      ['🤣', 'risa carcajada'],
      ['😊', 'timido feliz'],
      ['😇', 'angel inocente'],
      ['🙂', 'sonrisa leve'],
      ['🙃', 'ironia'],
      ['😉', 'guino'],
      ['😌', 'calma alivio'],
      ['😍', 'encanto amor'],
      ['🥰', 'cariño'],
      ['😘', 'beso'],
      ['😋', 'rico sabroso'],
      ['🤪', 'loco broma'],
      ['🤔', 'pensar duda'],
      ['🤨', 'sospecha'],
      ['🧐', 'analizar revisar'],
      ['🤓', 'estudioso tecnico'],
      ['😎', 'genial seguro'],
      ['🥳', 'fiesta'],
      ['😐', 'neutral'],
      ['😑', 'serio'],
      ['🙄', 'fastidio'],
      ['😔', 'triste'],
      ['😟', 'preocupado'],
      ['🥺', 'súplica ternura'],
      ['😢', 'llorar'],
      ['😭', 'llanto fuerte'],
      ['😤', 'molesto'],
      ['😠', 'enojado'],
      ['😱', 'susto'],
      ['😨', 'miedo'],
      ['😰', 'ansiedad'],
      ['😥', 'alivio triste'],
      ['😓', 'esfuerzo'],
      ['🤗', 'abrazo'],
      ['🤭', 'risita'],
      ['😶', 'silencio'],
      ['😴', 'dormido cansado'],
      ['🤤', 'babeo'],
      ['🤢', 'nauseas'],
      ['🤧', 'estornudo resfriado'],
      ['😷', 'mascarilla enfermo'],
      ['🤒', 'fiebre enfermo'],
      ['🤕', 'lesion herido'],
      ['🥴', 'mareado'],
    ],
  },
  {
    id: 'gestos',
    label: 'Gestos',
    emojis: [
      ['👎', 'no mal'],
      ['✌️', 'victoria dos'],
      ['🤞', 'suerte'],
      ['🤟', 'amor gesto'],
      ['🤘', 'rock'],
      ['🤙', 'llamame'],
      ['👈', 'izquierda'],
      ['👉', 'derecha señal'],
      ['👆', 'arriba'],
      ['👇', 'abajo'],
      ['☝️', 'atencion uno'],
      ['✋', 'alto pare'],
      ['🤚', 'mano'],
      ['🖐️', 'mano abierta'],
      ['🖖', 'saludo vulcano'],
      ['🤳', 'selfie'],
      ['✍️', 'escribir firma'],
      ['💅', 'uñas'],
      ['💍', 'anillo'],
      ['🫶', 'corazon manos'],
      ['🫡', 'saludo respeto'],
      ['👏', 'aplauso bien hecho'],
      ['🙌', 'celebrar manos arriba'],
    ],
  },
  {
    id: 'clinico',
    label: 'Clínico',
    emojis: [
      ['🩺', 'estetoscopio medico'],
      ['🩻', 'radiografia rayos x placa'],
      ['💊', 'medicamento pastilla'],
      ['💉', 'inyeccion vacuna'],
      ['🩹', 'curita vendaje'],
      ['🧬', 'adn genetica'],
      ['🔬', 'microscopio laboratorio'],
      ['🧪', 'tubo laboratorio'],
      ['🧫', 'cultivo'],
      ['🌡️', 'temperatura fiebre'],
      ['🏥', 'hospital clinica'],
      ['🚑', 'ambulancia emergencia'],
      ['🦴', 'hueso fractura'],
      ['🧠', 'cerebro'],
      ['❤️', 'corazon salud'],
      ['🫁', 'pulmones torax'],
      ['🫀', 'corazon organo'],
      ['👁️', 'ojo vision'],
      ['🧑‍⚕️', 'medico doctor'],
      ['📋', 'historial expediente'],
      ['🗂️', 'carpeta archivo'],
      ['🖨️', 'imprimir informe'],
    ],
  },
  {
    id: 'objetos',
    label: 'Objetos',
    emojis: [
      ['📁', 'carpeta'],
      ['📂', 'carpeta abierta'],
      ['📅', 'calendario fecha'],
      ['📆', 'calendario'],
      ['🗓️', 'agenda'],
      ['⏱️', 'cronometro tiempo'],
      ['⌛', 'espera'],
      ['📊', 'estadistica reporte'],
      ['📈', 'crecimiento subida'],
      ['📉', 'bajada'],
      ['📝', 'nota redactar'],
      ['🔖', 'marcador etiqueta'],
      ['🔔', 'notificacion aviso'],
      ['🔕', 'silenciar'],
      ['📞', 'telefono llamada'],
      ['📱', 'celular movil'],
      ['💻', 'computadora portatil'],
      ['🖥️', 'monitor pantalla'],
      ['📷', 'camara foto'],
      ['🔒', 'candado privado'],
      ['🔓', 'abierto'],
      ['🔑', 'llave clave'],
      ['⭐', 'favorito estrella'],
      ['✨', 'brillo nuevo'],
      ['⚡', 'rapido energia'],
      ['🔥', 'urgente fuego'],
      ['🚫', 'prohibido'],
      ['✔️', 'check visto'],
      ['➡️', 'siguiente derecha'],
      ['⬅️', 'atras'],
      ['🔄', 'actualizar repetir'],
      ['➕', 'agregar mas'],
      ['➖', 'quitar menos'],
      ['💯', 'perfecto'],
      ['❗', 'importante'],
      ['❓', 'pregunta duda'],
    ],
  },
];

/** Inserta un emoji en la posición del cursor del textarea y devuelve el texto resultante. */
export const insertarEmoji = (valor, emoji, elemento) => {
  if (!elemento) return `${valor || ''}${emoji}`;
  const inicio = elemento.selectionStart ?? (valor || '').length;
  const fin = elemento.selectionEnd ?? (valor || '').length;
  const texto = valor || '';
  const resultado = `${texto.slice(0, inicio)}${emoji}${texto.slice(fin)}`;
  requestAnimationFrame(() => {
    elemento.focus();
    const posicion = inicio + emoji.length;
    elemento.setSelectionRange(posicion, posicion);
  });
  return resultado;
};

export const leerEmojisRecientes = () => {
  try {
    const guardados = JSON.parse(localStorage.getItem(EMOJI_RECIENTES_KEY));
    return Array.isArray(guardados) ? guardados.slice(0, 24) : [];
  } catch {
    return [];
  }
};

export const guardarEmojiReciente = (emoji, actuales = []) => {
  const actualizados = [emoji, ...actuales.filter(e => e !== emoji)].slice(0, 24);
  try { localStorage.setItem(EMOJI_RECIENTES_KEY, JSON.stringify(actualizados)); } catch { /* almacenamiento no disponible */ }
  return actualizados;
};

export const buscarEmojis = (consulta) => {
  const q = consulta.trim().toLowerCase();
  if (!q) return [];
  return EMOJI_GRUPOS
    .flatMap(grupo => grupo.emojis)
    .filter(([, claves]) => claves.includes(q))
    .map(([emoji]) => emoji);
};
