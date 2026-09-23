import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  EMOJI_GRUPOS,
  buscarEmojis,
  guardarEmojiReciente,
  leerEmojisRecientes,
} from '../utils/emoji';

/**
 * Selector de emojis sin dependencias externas: pestañas por categoría, buscador
 * por palabras clave y últimos usados. Se cierra al hacer clic fuera o con Escape.
 */
const EmojiPicker = ({ onSelect, onClose, align = 'right', width = 306 }) => {
  const [grupo, setGrupo] = useState('frecuentes');
  const [consulta, setConsulta] = useState('');
  const [recientes, setRecientes] = useState(() => leerEmojisRecientes());
  const contenedorRef = useRef(null);

  useEffect(() => {
    const alClicFuera = (evento) => {
      if (!contenedorRef.current?.contains(evento.target)) onClose?.();
    };
    const alTecla = (evento) => {
      if (evento.key === 'Escape') { evento.stopPropagation(); onClose?.(); }
    };
    document.addEventListener('mousedown', alClicFuera);
    document.addEventListener('keydown', alTecla, true);
    return () => {
      document.removeEventListener('mousedown', alClicFuera);
      document.removeEventListener('keydown', alTecla, true);
    };
  }, [onClose]);

  const emojis = useMemo(() => {
    if (consulta.trim()) return buscarEmojis(consulta);
    if (grupo === 'recientes') return recientes;
    return (EMOJI_GRUPOS.find(g => g.id === grupo)?.emojis || []).map(([emoji]) => emoji);
  }, [consulta, grupo, recientes]);

  const elegir = (emoji) => {
    setRecientes(actuales => guardarEmojiReciente(emoji, actuales));
    onSelect(emoji);
  };

  const pestañas = EMOJI_GRUPOS.map(g => ({ id: g.id, label: g.label, icono: g.emojis[0][0] }));

  return (
    <div
      ref={contenedorRef}
      role="dialog"
      aria-label="Selector de emojis"
      style={{
        position: 'absolute', bottom: '100%', [align]: 0, marginBottom: 8, zIndex: 1200,
        width, background: '#fff', border: '1px solid var(--color-border)', borderRadius: 14,
        boxShadow: '0 18px 44px -12px rgba(15,23,42,0.35)', overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', gap: 2, padding: '6px 6px 0', borderBottom: '1px solid var(--color-border)', overflowX: 'auto' }}>
        {[{ id: 'recientes', label: 'Recientes', icono: '🕘' }, ...pestañas].map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setGrupo(t.id); setConsulta(''); }}
            title={t.label}
            style={{
              border: 'none', background: grupo === t.id && !consulta ? '#eff6ff' : 'transparent',
              cursor: 'pointer', borderRadius: 8, padding: '6px 8px', fontSize: 15, lineHeight: 1,
              opacity: grupo === t.id && !consulta ? 1 : 0.6, fontFamily: 'inherit',
            }}
          >
            <span aria-hidden="true">{t.icono}</span>
          </button>
        ))}
      </div>

      <div style={{ padding: 8, borderBottom: '1px solid var(--color-border)' }}>
        <input
          className="input"
          placeholder="Buscar emoji (urgente, placa, gracias...)"
          value={consulta}
          onChange={e => setConsulta(e.target.value)}
          style={{ fontSize: 12, padding: '6px 9px' }}
        />
      </div>

      <div style={{ maxHeight: 208, overflowY: 'auto', padding: 8 }}>
        {emojis.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center', padding: '18px 8px', margin: 0 }}>
            {consulta ? `Sin resultados para “${consulta}”.` : 'Todavía no usó ningún emoji.'}
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2 }}>
            {emojis.map((emoji, indice) => (
              <button
                key={`${emoji}-${indice}`}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => elegir(emoji)}
                title={emoji}
                style={{
                  border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 8,
                  fontSize: 20, lineHeight: 1, padding: '5px 0', transition: 'background 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span aria-hidden="true">{emoji}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '6px 10px', borderTop: '1px solid var(--color-border)', background: '#f8fafc' }}>
        <p style={{ margin: 0, fontSize: 10, color: 'var(--color-text-muted)' }}>
          Se guardan los últimos 24 emojis usados.
        </p>
      </div>
    </div>
  );
};

export default EmojiPicker;
