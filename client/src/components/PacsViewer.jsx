import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icons';

// Preajustes de ventana (brillo/contraste) habituales en radiología convencional.
const PRESETS = [
  { id: 'normal', label: 'Sin filtro', brillo: 1, contraste: 1 },
  { id: 'oseo', label: 'Óseo', brillo: 1.15, contraste: 1.5 },
  { id: 'pulmon', label: 'Pulmón', brillo: 1.35, contraste: 0.85 },
  { id: 'blandas', label: 'Partes blandas', brillo: 0.95, contraste: 1.15 },
];

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 6;

/**
 * Visor tipo PACS para radiografía convencional: zoom, desplazamiento, ventana
 * (brillo/contraste), inversión, rotación, herramientas de medición (distancia, ángulo),
 * pantalla completa y descarga de la placa que se está viendo.
 */
const PacsViewer = ({ imageUrl, imageName = '', index = 0, total = 1, onDownload, onPrevious, onNext }) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [brightness, setBrightness] = useState(1);
  const [contrast, setContrast] = useState(1);
  const [preset, setPreset] = useState('normal');
  const [invertido, setInvertido] = useState(false);
  const [rotacion, setRotacion] = useState(0);
  const [dragging, setDragging] = useState(false);
  
  // Herramientas: 'none', 'distancia', 'angulo'
  const [herramienta, setHerramienta] = useState('none');
  const [mediciones, setMediciones] = useState([]);
  
  const [borrador, setBorrador] = useState(null); // Para distancia: {x1, y1, x2, y2}
  const [borradorAngulo, setBorradorAngulo] = useState(null); // Para ángulo: { phase: 1|2, p1, p2, p3 }

  const zoomRef = useRef(1);
  const dragRef = useRef(null);
  const containerRef = useRef(null);
  const rootRef = useRef(null); // Nuevo ref para la pantalla completa

  const clampZoom = (valor) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, valor));

  const applyZoom = (siguiente, centerX, centerY) => {
    const nuevo = clampZoom(siguiente);
    const previo = zoomRef.current;
    if (nuevo === previo) return;
    if (centerX !== undefined && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const cx = centerX - rect.left - rect.width / 2;
      const cy = centerY - rect.top - rect.height / 2;
      const ratio = nuevo / previo;
      setPan(p => ({ x: cx - (cx - p.x) * ratio, y: cy - (cy - p.y) * ratio }));
    }
    zoomRef.current = nuevo;
    setZoom(nuevo);
  };

  const zoomBy = (factor, centerX, centerY) => applyZoom(zoomRef.current * factor, centerX, centerY);

  // Rueda no pasiva: evita el scroll de la página al hacer zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (evento) => {
      // Ignorar rueda si se hace sobre los controles internos
      if (evento.target.closest && evento.target.closest('button, input')) return;
      if (herramienta !== 'none') return;
      evento.preventDefault();
      zoomBy(evento.deltaY < 0 ? 1.15 : 1 / 1.15, evento.clientX, evento.clientY);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [herramienta]);

  const aplicarPreset = (presetId) => {
    const encontrado = PRESETS.find(p => p.id === presetId);
    if (!encontrado) return;
    setPreset(presetId);
    setBrightness(encontrado.brillo);
    setContrast(encontrado.contraste);
  };

  const reset = () => {
    zoomRef.current = 1;
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotacion(0);
    setInvertido(false);
    aplicarPreset('normal');
    setMediciones([]);
    setHerramienta('none');
    setBorrador(null);
    setBorradorAngulo(null);
  };

  const toggleFullscreen = () => {
    if (!rootRef.current) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current.requestFullscreen?.();
  };

  const calcularAngulo = (p1, p2, p3) => {
    const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
    const mag1 = Math.hypot(v1.x, v1.y);
    const mag2 = Math.hypot(v2.x, v2.y);
    if (mag1 === 0 || mag2 === 0) return 0;
    const dot = v1.x * v2.x + v1.y * v2.y;
    const angleRad = Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2))));
    return Math.round(angleRad * (180 / Math.PI));
  };

  const handlePointerDown = (evento) => {
    const rect = containerRef.current.getBoundingClientRect();
    const px = evento.clientX - rect.left;
    const py = evento.clientY - rect.top;
    
    setDragging(true);

    if (herramienta === 'distancia') {
      setBorrador({ x1: px, y1: py, x2: px, y2: py });
      evento.currentTarget.setPointerCapture?.(evento.pointerId);
      return;
    }
    
    if (herramienta === 'angulo') {
      if (!borradorAngulo || borradorAngulo.phase === 2) {
        // Iniciar nuevo ángulo
        setBorradorAngulo({ phase: 1, p1: { x: px, y: py }, p2: { x: px, y: py } });
      } else if (borradorAngulo.phase === 1) {
        // Iniciar el segundo vector
        setBorradorAngulo({ ...borradorAngulo, phase: 2, p3: { x: px, y: py } });
      }
      evento.currentTarget.setPointerCapture?.(evento.pointerId);
      return;
    }

    dragRef.current = { startX: evento.clientX, startY: evento.clientY, panX: pan.x, panY: pan.y };
    evento.currentTarget.setPointerCapture?.(evento.pointerId);
  };

  const handlePointerMove = (evento) => {
    if (!dragging) return;

    const rect = containerRef.current.getBoundingClientRect();
    const px = evento.clientX - rect.left;
    const py = evento.clientY - rect.top;

    if (herramienta === 'distancia' && borrador) {
      setBorrador({ ...borrador, x2: px, y2: py });
      return;
    }
    
    if (herramienta === 'angulo' && borradorAngulo) {
      if (borradorAngulo.phase === 1) {
        setBorradorAngulo({ ...borradorAngulo, p2: { x: px, y: py } });
      } else if (borradorAngulo.phase === 2) {
        setBorradorAngulo({ ...borradorAngulo, p3: { x: px, y: py } });
      }
      return;
    }

    if (dragRef.current) {
      setPan({
        x: dragRef.current.panX + (evento.clientX - dragRef.current.startX),
        y: dragRef.current.panY + (evento.clientY - dragRef.current.startY),
      });
    }
  };

  const handlePointerUp = () => {
    setDragging(false);

    if (herramienta === 'distancia' && borrador) {
      const distancia = Math.hypot(borrador.x2 - borrador.x1, borrador.y2 - borrador.y1);
      if (distancia > 4) {
        setMediciones(prev => [...prev, { type: 'distancia', ...borrador, px: Math.round(distancia / zoomRef.current) }]);
      }
      setBorrador(null);
      return;
    }

    if (herramienta === 'angulo' && borradorAngulo) {
      if (borradorAngulo.phase === 1) {
        // Verificamos si trazó algo útil
        const dist = Math.hypot(borradorAngulo.p2.x - borradorAngulo.p1.x, borradorAngulo.p2.y - borradorAngulo.p1.y);
        if (dist < 4) {
          // Fue solo un clic, cancelamos
          setBorradorAngulo(null);
        }
      } else if (borradorAngulo.phase === 2) {
        const deg = calcularAngulo(borradorAngulo.p1, borradorAngulo.p2, borradorAngulo.p3);
        setMediciones(prev => [...prev, { type: 'angulo', p1: borradorAngulo.p1, p2: borradorAngulo.p2, p3: borradorAngulo.p3, deg }]);
        setBorradorAngulo(null);
      }
      return;
    }

    dragRef.current = null;
  };

  const toggleHerramienta = (h) => {
    setHerramienta(prev => {
      setBorrador(null);
      setBorradorAngulo(null);
      return prev === h ? 'none' : h;
    });
  };

  return (
    <div ref={rootRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#060d1c', overflow: 'hidden' }}>
      
      {/* PANEL SUPERIOR: Herramientas e Información (0% Overlays) */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        background: '#0a1628', borderBottom: '1px solid #1e3a5f', padding: '10px 14px', zIndex: 30, flexShrink: 0
      }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {onPrevious && (
            <button title="Placa anterior" className="btn btn-sm" onClick={onPrevious} disabled={index <= 0}
              style={{ background: 'rgba(255,255,255,0.08)', color: '#a8c4e4', padding: '5px 8px', opacity: index <= 0 ? 0.4 : 1, display: 'flex' }}>
              <Icon name="chevronLeft" size={14} color="#a8c4e4" />
            </button>
          )}
          {onNext && (
            <button title="Placa siguiente" className="btn btn-sm" onClick={onNext} disabled={index >= total - 1}
              style={{ background: 'rgba(255,255,255,0.08)', color: '#a8c4e4', padding: '5px 8px', opacity: index >= total - 1 ? 0.4 : 1, display: 'flex' }}>
              <Icon name="chevronRight" size={14} color="#a8c4e4" />
            </button>
          )}
          
          <div style={{ width: 1, background: '#1e3a5f', margin: '0 4px' }} />

          <button title="Alejar" className="btn btn-sm" onClick={() => zoomBy(1 / 1.25)} style={{ background: 'rgba(51,153,255,0.18)', color: '#cfe6ff', padding: '5px 9px', display: 'flex' }}>
            <Icon name="zoomOut" size={14} color="#cfe6ff" />
          </button>
          <button title="Acercar" className="btn btn-sm" onClick={() => zoomBy(1.25)} style={{ background: 'rgba(51,153,255,0.18)', color: '#cfe6ff', padding: '5px 9px', display: 'flex' }}>
            <Icon name="zoom" size={14} color="#cfe6ff" />
          </button>
          <button title="Ajustar (100%)" className="btn btn-sm" onClick={reset} style={{ background: 'rgba(255,255,255,0.08)', color: '#a8c4e4', padding: '4px 9px', fontSize: 11 }}>1:1</button>
          
          <div style={{ width: 1, background: '#1e3a5f', margin: '0 4px' }} />

          <button
            title="Medir distancia"
            className="btn btn-sm"
            onClick={() => toggleHerramienta('distancia')}
            style={{ background: herramienta === 'distancia' ? '#268ce3' : 'rgba(255,255,255,0.08)', color: herramienta === 'distancia' ? '#fff' : '#a8c4e4', padding: '5px 9px', display: 'flex' }}
          >
            <Icon name="ruler" size={14} color={herramienta === 'distancia' ? '#fff' : '#a8c4e4'} />
          </button>
          
          <button
            title="Medir ángulo (arrastrar 2 veces)"
            className="btn btn-sm"
            onClick={() => toggleHerramienta('angulo')}
            style={{ background: herramienta === 'angulo' ? '#268ce3' : 'rgba(255,255,255,0.08)', color: herramienta === 'angulo' ? '#fff' : '#a8c4e4', padding: '5px 12px', display: 'flex', fontWeight: 600 }}
          >
            ∠
          </button>

          <div style={{ width: 1, background: '#1e3a5f', margin: '0 4px' }} />

          <button title="Girar 90°" className="btn btn-sm" onClick={() => setRotacion(r => (r + 90) % 360)} style={{ background: 'rgba(255,255,255,0.08)', color: '#a8c4e4', padding: '5px 9px', display: 'flex' }}>
            <Icon name="rotate" size={14} color="#a8c4e4" />
          </button>
          <button title="Invertir (negativo)" className="btn btn-sm" onClick={() => setInvertido(v => !v)} style={{ background: invertido ? '#268ce3' : 'rgba(255,255,255,0.08)', color: invertido ? '#fff' : '#a8c4e4', padding: '5px 9px', display: 'flex' }}>
            <Icon name="contrast" size={14} color={invertido ? '#fff' : '#a8c4e4'} />
          </button>
          
          <div style={{ width: 1, background: '#1e3a5f', margin: '0 4px' }} />

          <button title="Pantalla completa" className="btn btn-sm" onClick={toggleFullscreen} style={{ background: 'rgba(255,255,255,0.08)', color: '#a8c4e4', padding: '5px 9px', display: 'flex' }}>
            <Icon name="fullscreen" size={14} color="#a8c4e4" />
          </button>
          {onDownload && (
            <button title="Descargar esta radiografía" className="btn btn-sm" onClick={onDownload}
              style={{ background: 'rgba(34,197,94,0.22)', color: '#bbf7d0', padding: '5px 9px', display: 'flex' }}>
              <Icon name="download" size={14} color="#bbf7d0" />
            </button>
          )}
        </div>

        <div style={{ textAlign: 'right', color: '#a8c4e4', fontSize: 11, maxWidth: 300 }}>
          <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{imageName || 'Radiografía'}</div>
          <div style={{ color: '#5f7ba0', marginTop: 2 }}>Placa {total > 1 ? `${index + 1} de ${total}` : 'única'} · {Math.round(zoom * 100)}%</div>
        </div>
      </div>

      {/* ÁREA DE LA IMAGEN (Libre de obstrucciones) */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          cursor: herramienta !== 'none' ? 'crosshair' : dragging ? 'grabbing' : zoom > 1 ? 'grab' : 'default',
          userSelect: 'none', touchAction: 'none',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <img
            src={imageUrl}
            alt="Radiografía"
            draggable={false}
            onError={e => { e.target.style.display = 'none'; }}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotacion}deg)`,
              transformOrigin: 'center center',
              maxWidth: '100%', maxHeight: '100%',
              objectFit: 'contain',
              imageRendering: '-webkit-optimize-contrast',
              filter: `brightness(${brightness}) contrast(${contrast})${invertido ? ' invert(1)' : ''}`,
              transition: dragging ? 'none' : 'transform 0.05s linear',
              willChange: 'transform',
            }}
          />
        </div>

        {/* Capa de Mediciones SVG */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 15 }}>
          
          {/* Mediciones guardadas (Distancias y Ángulos) */}
          {mediciones.map((m, i) => {
            if (m.type === 'distancia') {
              return (
                <g key={i}>
                  <line x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} stroke="#facc15" strokeWidth="1.6" />
                  <circle cx={m.x1} cy={m.y1} r="3" fill="#facc15" />
                  <circle cx={m.x2} cy={m.y2} r="3" fill="#facc15" />
                  <text x={(m.x1 + m.x2) / 2 + 8} y={(m.y1 + m.y2) / 2 - 8} fill="#fde68a" fontSize="12" fontWeight="700">
                    {m.px} px
                  </text>
                </g>
              );
            }
            if (m.type === 'angulo') {
              return (
                <g key={i}>
                  <line x1={m.p1.x} y1={m.p1.y} x2={m.p2.x} y2={m.p2.y} stroke="#38bdf8" strokeWidth="1.6" />
                  <line x1={m.p2.x} y1={m.p2.y} x2={m.p3.x} y2={m.p3.y} stroke="#38bdf8" strokeWidth="1.6" />
                  <circle cx={m.p1.x} cy={m.p1.y} r="3" fill="#38bdf8" />
                  <circle cx={m.p2.x} cy={m.p2.y} r="3" fill="#0284c7" /> {/* Vértice principal */}
                  <circle cx={m.p3.x} cy={m.p3.y} r="3" fill="#38bdf8" />
                  <text x={m.p2.x + 10} y={m.p2.y - 10} fill="#bae6fd" fontSize="12" fontWeight="700">
                    {m.deg}°
                  </text>
                </g>
              );
            }
            return null;
          })}

          {/* Borrador en curso para Distancia */}
          {herramienta === 'distancia' && borrador && (
            <g>
              <line x1={borrador.x1} y1={borrador.y1} x2={borrador.x2} y2={borrador.y2} stroke="#facc15" strokeWidth="1.6" strokeDasharray="5 4" />
              <circle cx={borrador.x1} cy={borrador.y1} r="3" fill="#facc15" />
              <circle cx={borrador.x2} cy={borrador.y2} r="3" fill="#facc15" />
            </g>
          )}

          {/* Borrador en curso para Ángulo */}
          {herramienta === 'angulo' && borradorAngulo && (
            <g>
              <circle cx={borradorAngulo.p1.x} cy={borradorAngulo.p1.y} r="3" fill="#38bdf8" />
              <circle cx={borradorAngulo.p2.x} cy={borradorAngulo.p2.y} r="3" fill="#0284c7" />
              <line x1={borradorAngulo.p1.x} y1={borradorAngulo.p1.y} x2={borradorAngulo.p2.x} y2={borradorAngulo.p2.y} stroke="#38bdf8" strokeWidth="1.6" strokeDasharray="5 4" />
              
              {borradorAngulo.phase === 2 && borradorAngulo.p3 && (
                <>
                  <line x1={borradorAngulo.p2.x} y1={borradorAngulo.p2.y} x2={borradorAngulo.p3.x} y2={borradorAngulo.p3.y} stroke="#38bdf8" strokeWidth="1.6" strokeDasharray="5 4" />
                  <circle cx={borradorAngulo.p3.x} cy={borradorAngulo.p3.y} r="3" fill="#38bdf8" />
                  <text x={borradorAngulo.p2.x + 10} y={borradorAngulo.p2.y - 10} fill="#bae6fd" fontSize="12" fontWeight="700">
                    {calcularAngulo(borradorAngulo.p1, borradorAngulo.p2, borradorAngulo.p3)}°
                  </text>
                </>
              )}
            </g>
          )}
        </svg>
      </div>

      {/* PANEL INFERIOR: Filtros y Mediciones */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        background: '#0a1628', borderTop: '1px solid #1e3a5f', padding: '10px 14px', zIndex: 30, flexShrink: 0
      }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => aplicarPreset(p.id)}
              style={{
                border: 'none', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                background: preset === p.id ? '#268ce3' : 'rgba(255,255,255,0.08)',
                color: preset === p.id ? '#fff' : '#8fa9cc',
                transition: 'all 0.15s ease',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#8fa9cc', background: 'rgba(0,0,0,0.2)', padding: '4px 10px', borderRadius: 8 }}>
          <Icon name="sun" size={14} color="#8fa9cc" />
          <input type="range" min="0.4" max="2" step="0.05" value={brightness}
            onChange={e => { setBrightness(parseFloat(e.target.value)); setPreset('custom'); }} style={{ width: 80, accentColor: '#3399FF' }} />
          <span className="mono" style={{ width: 34, textAlign: 'right' }}>{Math.round(brightness * 100)}%</span>
        </label>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#8fa9cc', background: 'rgba(0,0,0,0.2)', padding: '4px 10px', borderRadius: 8 }}>
          <Icon name="contrast" size={14} color="#8fa9cc" />
          <input type="range" min="0.4" max="2.5" step="0.05" value={contrast}
            onChange={e => { setContrast(parseFloat(e.target.value)); setPreset('custom'); }} style={{ width: 80, accentColor: '#3399FF' }} />
          <span className="mono" style={{ width: 34, textAlign: 'right' }}>{Math.round(contrast * 100)}%</span>
        </label>
        
        {mediciones.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(125,211,252,0.1)', padding: '4px 10px', borderRadius: 8 }}>
            <span style={{ fontSize: 11, color: '#7dd3fc', fontWeight: 700 }}>
              {mediciones.length} medida{mediciones.length > 1 ? 's' : ''}
            </span>
            <button className="btn btn-sm" onClick={() => setMediciones([])} style={{ background: 'rgba(255,255,255,0.1)', color: '#bae6fd', padding: '3px 8px', fontSize: 10.5 }}>
              Limpiar
            </button>
          </div>
        )}
        
        <span style={{ flex: 1 }} />
        
        <span style={{ fontSize: 10.5, color: '#5f7ba0' }}>
          {herramienta === 'angulo' 
            ? 'Arrastre para trazar la primera línea, luego arrastre para la segunda.' 
            : herramienta === 'distancia' 
              ? 'Arrastre sobre la imagen para medir distancia.' 
              : zoom > 1 
                ? 'Arrastre · rueda = zoom' 
                : 'Rueda del mouse para zoom'}
        </span>
      </div>
    </div>
  );
};

export default PacsViewer;
