import React, { useCallback, useEffect, useState } from 'react';
import Icon from './Icons';
import { API_URL } from '../config';

const PERIODOS = [
  { dias: 7, label: '7 días' },
  { dias: 30, label: '30 días' },
  { dias: 90, label: '90 días' },
  { dias: 365, label: '12 meses' },
];

const ESTADO_COLORS = {
  Recibida: '#38bdf8',
  'Pendiente de enviar al radiólogo': '#f59e0b',
  'Enviada al radiólogo': '#f97316',
  'Diagnóstico recibido': '#22c55e',
  'Devuelta por revisión': '#f43f5e',
  'Listo para imprimir': '#14b8a6',
  Entregado: '#94a3b8',
};

const colorHoras = (horas) => {
  if (horas === null || horas === undefined) return { bg: '#f8fafc', text: '#64748b' };
  if (horas <= 24) return { bg: '#f0fdf4', text: '#15803d' };
  if (horas <= 48) return { bg: '#fffbeb', text: '#b45309' };
  return { bg: '#fef2f2', text: '#b91c1c' };
};

const formatHoras = (horas) => {
  if (horas === null || horas === undefined) return 'Sin datos';
  if (horas < 24) return `${horas.toFixed(1)} h`;
  const dias = horas / 24;
  return `${dias.toFixed(1)} días`;
};

/**
 * Panel de reportes del encargado: productividad por radiólogo, médicos remitentes,
 * cumplimiento del ciclo de entrega y estudios con fecha estimada vencida.
 */
const ReportesView = ({ headers, onOpenStudy }) => {
  const [dias, setDias] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    setLoading(true);
    setError('');
    fetch(`${API_URL}/api/reportes/productividad?dias=${dias}`, { headers })
      .then(r => r.json())
      .then(d => { if (d && d.totales) setData(d); else setError(d.error || 'No se pudo cargar el reporte'); })
      .catch(() => setError('No se pudo conectar con el servidor'))
      .finally(() => setLoading(false));
  }, [dias, headers]);

  useEffect(() => { cargar(); }, [cargar]);

  const exportCSV = () => {
    if (!data) return;
    const lineas = [
      `Reporte de productividad,${data.desde} a hoy,${data.dias} días`,
      '',
      'Radiólogo,Asignados,Informes emitidos,Entregados,Horas promedio de lectura',
      ...data.radiologos.map(r => `${r.radiologo},${r.asignados},${r.informes},${r.entregados},${r.horas_promedio ?? ''}`),
      '',
      'Médico remitente,Estudios,Entregados',
      ...data.medicos.map(m => `${m.medico},${m.total},${m.entregados}`),
      '',
      'Región anatómica,Estudios,Urgentes',
      ...(data.regiones || []).map(r => `${r.region},${r.total},${r.urgentes}`),
      '',
      'Registro,Paciente,Tipo,Estado,Entrega estimada',
      ...data.vencidos.map(v => `${v.registro_id},${v.nombre},${v.tipo_estudio},${v.estado},${v.fecha_entrega_estimada}`),
    ];
    const blob = new Blob(['\uFEFF' + lineas.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `productividad_${data.dias}dias_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const maxMedicos = data?.medicos?.[0]?.total || 1;
  const maxRegion = data?.regiones?.[0]?.total || 1;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', background: 'var(--color-surface-2)', borderRadius: 10, padding: 3, border: '1px solid var(--color-border)' }}>
          {PERIODOS.map(p => (
            <button
              key={p.dias}
              onClick={() => setDias(p.dias)}
              style={{
                padding: '7px 13px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
                backgroundColor: dias === p.dias ? '#fff' : 'transparent',
                color: dias === p.dias ? 'var(--color-primary)' : 'var(--color-text-muted)',
                boxShadow: dias === p.dias ? 'var(--shadow-sm)' : 'none',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={cargar} style={{ gap: 5 }} title="Actualizar reporte">
          <Icon name="rotate" size={13} /> Actualizar
        </button>
        <button className="btn btn-secondary btn-sm" onClick={exportCSV} disabled={!data} style={{ gap: 5 }}>
          <Icon name="download" size={13} color="#fff" /> Exportar CSV
        </button>
        {data && (
          <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>
            Período: {data.desde} → hoy
          </span>
        )}
      </div>

      {error && (
        <div className="alert alert-danger">
          <Icon name="warning" size={14} color="#b91c1c" />
          <span>{error}</span>
        </div>
      )}

      {loading && !data ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 88 }} />)}
        </div>
      ) : data ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
            <KpiCard label="Estudios del período" value={data.totales.estudios} color="#003366" icon="xray" />
            <KpiCard label="Informes emitidos" value={data.totales.informes} color="#0f766e" icon="fileText" />
            <KpiCard label="Entregados" value={data.totales.entregados} color="#15803d" icon="package" />
            <KpiCard label="Pendientes" value={data.totales.pendientes} color="#b45309" icon="clock" />
            <KpiCard label="Urgentes activos" value={data.totales.urgentes} color="#b91c1c" icon="bell" />
          </div>

          <div className="card-flat" style={{ padding: 18, margin: 0 }}>
            <div className="section-title">
              <Icon name="microscope" size={14} color="var(--color-text-secondary)" /> Productividad por radiólogo
            </div>
            {data.radiologos.length === 0 ? (
              <p className="text-muted" style={{ fontSize: 13 }}>Sin estudios asignados a radiólogos en este período.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Radiólogo</th>
                      <th style={{ width: 110 }}>Asignados</th>
                      <th style={{ width: 130 }}>Informes</th>
                      <th style={{ width: 110 }}>Entregados</th>
                      <th style={{ width: 170 }}>Tiempo de lectura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.radiologos.map(r => {
                      const c = colorHoras(r.horas_promedio);
                      return (
                        <tr key={r.radiologo}>
                          <td style={{ fontWeight: 600, fontSize: 13.5 }}>{r.radiologo}</td>
                          <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.asignados}</td>
                          <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: 'var(--color-primary)' }}>{r.informes}</td>
                          <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.entregados}</td>
                          <td>
                            <span className="badge" style={{ background: c.bg, color: c.text, fontSize: 11.5 }}>
                              {formatHoras(r.horas_promedio)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-muted" style={{ marginTop: 10 }}>
              El tiempo de lectura se calcula desde el envío de las placas al radiólogo hasta la emisión del informe. Verde ≤ 24 h, ámbar ≤ 48 h, rojo &gt; 48 h.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            <div className="card-flat" style={{ padding: 18, margin: 0 }}>
              <div className="section-title">
                <Icon name="users" size={14} color="var(--color-text-secondary)" /> Médicos remitentes
              </div>
              {data.medicos.length === 0 ? (
                <p className="text-muted" style={{ fontSize: 13 }}>Sin datos en el período.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.medicos.map(m => (
                    <div key={m.medico}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3 }}>
                        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{m.medico}</span>
                        <span style={{ color: 'var(--color-text-muted)', fontWeight: 700 }}>{m.total}</span>
                      </div>
                      <div style={{ height: 7, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.round((m.total / maxMedicos) * 100)}%`, height: '100%', background: 'linear-gradient(90deg,#0f766e,#34d399)', borderRadius: 999 }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card-flat" style={{ padding: 18, margin: 0 }}>
              <div className="section-title">
                <Icon name="bone" size={14} color="var(--color-text-secondary)" /> Producción por región anatómica
              </div>
              {(data.regiones || []).length === 0 ? (
                <p className="text-muted" style={{ fontSize: 13 }}>Sin datos en el período.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(data.regiones || []).map(r => (
                    <div key={r.region}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3, gap: 8 }}>
                        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.region}
                          {r.urgentes > 0 && <span className="badge badge-red" style={{ marginLeft: 6, fontSize: 10 }}>{r.urgentes} urg.</span>}
                        </span>
                        <span style={{ color: 'var(--color-text-muted)', fontWeight: 700 }}>{r.total}</span>
                      </div>
                      <div style={{ height: 7, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.round((r.total / maxRegion) * 100)}%`, height: '100%', background: 'linear-gradient(90deg,#1d4ed8,#60a5fa)', borderRadius: 999 }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card-flat" style={{ padding: 18, margin: 0 }}>
              <div className="section-title">
                <Icon name="warning" size={14} color="#b45309" /> Entregas vencidas
                {data.vencidos.length > 0 && <span className="badge badge-red" style={{ marginLeft: 6, fontSize: 10.5 }}>{data.vencidos.length}</span>}
              </div>
              {data.vencidos.length === 0 ? (
                <p className="text-muted" style={{ fontSize: 13 }}>Ningún estudio superó su fecha de entrega estimada.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                  {data.vencidos.map(v => (
                    <div key={v.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
                      border: `1px solid ${v.urgente ? '#fecaca' : 'var(--color-border)'}`, background: v.urgente ? '#fef2f2' : '#f8fafc',
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: ESTADO_COLORS[v.estado] || '#94a3b8', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {v.nombre} {v.urgente ? '· URGENTE' : ''}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                          <span className="mono">{v.registro_id}</span> · {v.tipo_estudio} · vencía {v.fecha_entrega_estimada}
                        </p>
                      </div>
                      <button className="btn btn-ghost btn-xs" onClick={() => onOpenStudy?.(v)} style={{ gap: 4 }}>
                        <Icon name="eye" size={11} /> Ver
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

const KpiCard = ({ label, value, color, icon }) => (
  <div className="card-flat" style={{ padding: 16, margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
    <div style={{ width: 40, height: 40, borderRadius: 12, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon name={icon} size={18} color={color} />
    </div>
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    </div>
  </div>
);

export default ReportesView;
