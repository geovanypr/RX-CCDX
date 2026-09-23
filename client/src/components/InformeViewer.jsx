import React, { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import Icon from './Icons';
import { API_URL, downloadAuthenticatedFile } from '../config';
import { sexoLabel } from '../utils/format';

/**
 * Visor e impresor de informe radiológico clínico.
 * Muestra e imprime todos los datos del paciente, estudio, diagnóstico y membrete oficial.
 */
const InformeViewer = ({ estudio, userRole, onClose, onSaved, autoPrint = false }) => {
  const { user } = useContext(AuthContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const hasAutoPrinted = useRef(false);

  const headers = { Authorization: `Bearer ${user.token}` };
  const isEncargado = userRole === 'ENCARGADO' || userRole === 'SUPER_ADMIN';
  const isRadiologo = userRole === 'RADIOLOGO' || userRole === 'SUPER_ADMIN';

  useEffect(() => {
    fetch(`${API_URL}/api/estudios/${estudio.id}/informe/preview`, { headers })
      .then(r => r.json())
      .then(d => {
        setData(d);
        setEditText(d.diagnostico || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [estudio.id]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handlePrint = () => {
    if (!data) return;

    const fechaHoy = new Date().toLocaleDateString('es-HN', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    const printHtml = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Informe Radiológico — ${data.registro_id} — ${data.paciente}</title>
        <style>
          @page {
            size: letter portrait;
            margin: 14mm 16mm 14mm 16mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: 'Times New Roman', Times, Georgia, serif;
            color: #111827;
            background: #fff;
            margin: 0;
            padding: 0;
            font-size: 11pt;
            line-height: 1.5;
          }
          .report-page {
            width: 100%;
            display: flex;
            flex-direction: column;
            min-height: 100%;
          }
          .header-box {
            border-bottom: 2.5px solid #003366;
            padding-bottom: 10px;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .brand-col {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .brand-logo {
            width: 54px;
            height: 54px;
            object-fit: contain;
          }
          .brand-title {
            font-size: 18pt;
            font-weight: 800;
            color: #003366;
            margin: 0;
            letter-spacing: -0.02em;
            font-family: Arial, Helvetica, sans-serif;
          }
          .brand-subtitle {
            font-size: 9pt;
            color: #4b5563;
            margin: 2px 0 0;
            font-family: Arial, Helvetica, sans-serif;
          }
          .center-contact {
            text-align: right;
            font-size: 8.5pt;
            color: #4b5563;
            font-family: Arial, Helvetica, sans-serif;
            line-height: 1.35;
          }
          .doc-title {
            text-align: center;
            font-size: 13pt;
            font-weight: bold;
            color: #003366;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            margin: 10px 0 12px;
            padding: 4px 0;
            background: #f0f4f8;
            border-radius: 4px;
            font-family: Arial, Helvetica, sans-serif;
          }
          .patient-card {
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 10px 14px;
            margin-bottom: 16px;
            background: #fafbfc;
            font-size: 9.5pt;
          }
          .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 5px 20px;
          }
          .field-row {
            display: flex;
            margin: 2px 0;
          }
          .field-label {
            font-weight: bold;
            color: #1e293b;
            min-width: 140px;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 8.5pt;
            text-transform: uppercase;
          }
          .field-value {
            color: #0f172a;
            flex: 1;
          }
          .field-mono {
            font-family: 'Courier New', Courier, monospace;
            font-weight: bold;
          }
          .urgent-tag {
            display: inline-block;
            background: #fee2e2;
            color: #991b1b;
            border: 1px solid #f87171;
            padding: 1px 6px;
            border-radius: 4px;
            font-size: 8pt;
            font-weight: bold;
            font-family: Arial, Helvetica, sans-serif;
            margin-left: 6px;
          }
          .section-heading {
            font-size: 11pt;
            font-weight: bold;
            color: #003366;
            text-transform: uppercase;
            border-bottom: 1px solid #94a3b8;
            padding-bottom: 3px;
            margin: 14px 0 10px;
            letter-spacing: 0.5px;
            font-family: Arial, Helvetica, sans-serif;
          }
          .diagnostico-content {
            font-size: 11.5pt;
            line-height: 1.8;
            color: #111827;
            white-space: pre-wrap;
            word-break: break-word;
            min-height: 140px;
            text-align: justify;
            margin-bottom: 24px;
          }
          .signature-wrapper {
            margin-top: auto;
            padding-top: 30px;
            page-break-inside: avoid;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
          }
          .signature-line {
            width: 240px;
            border-top: 1.5px solid #1e293b;
            margin: 0 auto 6px;
          }
          .doctor-name {
            font-size: 11pt;
            font-weight: bold;
            color: #0f172a;
            font-family: Arial, Helvetica, sans-serif;
          }
          .doctor-specialty {
            font-size: 9pt;
            color: #475569;
            font-family: Arial, Helvetica, sans-serif;
          }
          .report-footer {
            margin-top: 24px;
            padding-top: 8px;
            border-top: 1px solid #e2e8f0;
            font-size: 8pt;
            color: #64748b;
            text-align: center;
            font-family: Arial, Helvetica, sans-serif;
            line-height: 1.4;
          }
          .stamp-box {
            font-size: 7.5pt;
            color: #94a3b8;
            margin-top: 4px;
          }
        </style>
      </head>
      <body>
        <div class="report-page">
          <!-- Encabezado Institucional -->
          <div class="header-box">
            <div class="brand-col">
              <img src="/logo.png" class="brand-logo" alt="${data.centro_nombre || 'RX CCDX'}" onerror="this.style.display='none'" />
              <div>
                <h1 class="brand-title">${data.centro_nombre || 'RX CCDX'}</h1>
                <p class="brand-subtitle">Departamento de Radiología e Imágenes Diagnósticas</p>
                ${data.centro_rnc ? `<p class="brand-subtitle" style="font-size:8pt">RNC: ${data.centro_rnc}</p>` : ''}
              </div>
            </div>
            <div class="center-contact">
              ${data.centro_direccion ? `<div>${data.centro_direccion}</div>` : ''}
              ${data.centro_telefono ? `<div>Tel: ${data.centro_telefono}</div>` : ''}
              ${data.centro_email ? `<div>${data.centro_email}</div>` : ''}
              <div style="font-weight:bold; margin-top:2px;">Fecha de emisión: ${fechaHoy}</div>
            </div>
          </div>

          <!-- Título del documento -->
          <div class="doc-title">INFORME RADIOLÓGICO</div>

          <!-- Ficha de Datos del Paciente y Estudio -->
          <div class="patient-card">
            <div class="grid-2">
              <div class="field-row">
                <span class="field-label">Paciente:</span>
                <span class="field-value" style="font-weight:bold; font-size:10pt;">${data.paciente}</span>
              </div>
              <div class="field-row">
                <span class="field-label">No. Registro:</span>
                <span class="field-value field-mono">${data.registro_id}</span>
              </div>
              <div class="field-row">
                <span class="field-label">Edad / Sexo:</span>
                <span class="field-value">${data.edad} años · ${sexoLabel(data.sexo)}</span>
              </div>
              <div class="field-row">
                <span class="field-label">Fecha del estudio:</span>
                <span class="field-value">${data.fecha_estudio || '—'}</span>
              </div>
              ${data.fecha_nacimiento ? `
              <div class="field-row">
                <span class="field-label">F. Nacimiento:</span>
                <span class="field-value">${data.fecha_nacimiento}</span>
              </div>` : ''}
              ${data.telefono ? `
              <div class="field-row">
                <span class="field-label">Teléfono:</span>
                <span class="field-value">${data.telefono}</span>
              </div>` : ''}
              <div class="field-row">
                <span class="field-label">Estudio realizado:</span>
                <span class="field-value" style="font-weight:600;">${data.tipo_estudio?.toUpperCase() || '—'}</span>
              </div>
              ${data.region ? `
              <div class="field-row">
                <span class="field-label">Región anatómica:</span>
                <span class="field-value">${data.region.toUpperCase()}</span>
              </div>` : ''}
              ${data.lateralidad ? `
              <div class="field-row">
                <span class="field-label">Lateralidad:</span>
                <span class="field-value">${data.lateralidad.toUpperCase()}</span>
              </div>` : ''}
              <div class="field-row">
                <span class="field-label">Médico remitente:</span>
                <span class="field-value">${data.medico_remitente || 'No especificado'}</span>
              </div>
              ${data.urgente ? `
              <div class="field-row">
                <span class="field-label">Prioridad:</span>
                <span class="field-value"><span class="urgent-tag">URGENTE</span></span>
              </div>` : ''}
              ${data.fecha_entrega_estimada ? `
              <div class="field-row">
                <span class="field-label">Fecha de entrega:</span>
                <span class="field-value">${data.fecha_entrega_estimada}</span>
              </div>` : ''}
            </div>
            ${data.notas_clinicas ? `
              <div class="field-row" style="margin-top:6px; padding-top:6px; border-top:1px dashed #e2e8f0;">
                <span class="field-label">Indicación clínica:</span>
                <span class="field-value" style="font-style:italic;">${data.notas_clinicas}</span>
              </div>
            ` : ''}
          </div>

          <!-- Hallazgos y Diagnóstico -->
          <div class="section-heading">Hallazgos e Interpretación Radiológica</div>
          <div class="diagnostico-content">${data.diagnostico}</div>

          <!-- Firma y Sello del Radiólogo -->
          <div class="signature-wrapper">
            <div class="signature-line"></div>
            <div class="doctor-name">${data.radiologo_nombre || 'Dr. Alcántara'}</div>
            <div class="doctor-specialty">Médico Radiólogo · Especialista en Imágenes Diagnósticas</div>
            <div class="stamp-box">Documento electrónico validado por el centro radiológico</div>
          </div>

          <!-- Pie de página institucional -->
          <div class="report-footer">
            ${data.informe_pie || 'Este informe radiológico es confidencial y para uso exclusivo del médico tratante y del paciente.'}
            <div style="margin-top:2px; font-size:7.5pt; opacity:0.8;">
              RX CCDX · Registro: ${data.registro_id} · ${fechaHoy}
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Usar iframe oculto para una impresión confiable sin bloqueo de popups
    let iframe = document.getElementById('print-report-iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'print-report-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(printHtml);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        // Fallback a ventana emergente si el navegador restringe el iframe
        const win = window.open('', '_blank');
        if (win) {
          win.document.open();
          win.document.write(printHtml);
          win.document.close();
          win.onload = () => { win.focus(); win.print(); };
          if (win.document.readyState === 'complete') { win.focus(); win.print(); }
        }
      }
    }, 250);
  };

  // Impresión automática al abrir si viene marcado autoPrint
  useEffect(() => {
    if (autoPrint && data?.diagnostico && !hasAutoPrinted.current) {
      hasAutoPrinted.current = true;
      handlePrint();
    }
  }, [autoPrint, data]);

  const handleSave = async () => {
    if (!editText.trim()) return;
    setSaving(true);
    const method = isRadiologo ? 'POST' : 'PUT';
    try {
      const res = await fetch(`${API_URL}/api/estudios/${estudio.id}/diagnostico`, {
        method,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagnostico: editText }),
      });
      const d = await res.json();
      if (d.success) {
        setData(prev => ({ ...prev, diagnostico: editText }));
        setEditing(false);
        onSaved?.();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadZip = async () => {
    try {
      await downloadAuthenticatedFile(`/api/estudios/${estudio.id}/export`, user.token, `${estudio.nombre}_${data?.registro_id || 'estudio'}.zip`);
    } catch { /* fallo silencioso */ }
  };

  const handleDownloadDocx = async () => {
    try {
      await downloadAuthenticatedFile(`/api/estudios/${estudio.id}/informe/download`, user.token, `Informe_${estudio.nombre}_${data?.registro_id || 'estudio'}.docx`);
    } catch { /* fallo silencioso */ }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 840, maxHeight: '96vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg,#eff6ff,#dbeafe)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="fileText" size={22} color="#1a66b3" />
          </div>
          <div className="flex-1">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-primary)' }}>
                Informe Radiológico
              </span>
              {data && <span className="chip mono">{data.registro_id}</span>}
              {data?.urgente && (
                <span className="badge badge-red" style={{ fontSize: 9.5, padding: '2px 7px' }}>
                  URGENTE
                </span>
              )}
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 2 }}>
              {estudio.nombre} · {estudio.tipo_estudio}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {data?.diagnostico && !editing && (
              <>
                {(isEncargado || isRadiologo) && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)} style={{ gap: 5 }}>
                    <Icon name="edit" size={13} /> Editar
                  </button>
                )}
                <button className="btn btn-success btn-sm" onClick={handlePrint} style={{ gap: 5 }}>
                  <Icon name="print" size={13} /> Imprimir Todo
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleDownloadDocx} style={{ gap: 5 }}>
                  <Icon name="download" size={13} /> Word
                </button>
                <button className="btn btn-ghost btn-sm" onClick={handleDownloadZip} style={{ gap: 5 }}>
                  <Icon name="download" size={13} /> ZIP
                </button>
              </>
            )}
            <button className="modal-close" onClick={onClose}>
              <Icon name="close" size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ background: '#e8ecf3', padding: '20px 24px', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <div className="spinner" />
            </div>
          ) : !data?.diagnostico ? (
            <div className="empty-state" style={{ padding: 48 }}>
              <div style={{ marginBottom: 12 }}><Icon name="fileText" size={44} color="#94a3b8" /></div>
              <h4>Sin diagnóstico emitido</h4>
              <p>El radiólogo no ha emitido el diagnóstico de este estudio aún.</p>
            </div>
          ) : editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="paper" style={{ flex: 1 }}>
                <div className="paper-letterhead" style={{ padding: '14px 18px' }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{data.centro_nombre}</div>
                </div>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', fontFamily: '"Times New Roman", Times, serif', fontSize: 12.5, lineHeight: 1.9 }}>
                  <div><strong>PACIENTE:</strong> {data.paciente}</div>
                  <div><strong>REGISTRO:</strong> {data.registro_id}</div>
                  <div><strong>ESTUDIO:</strong> {data.tipo_estudio?.toUpperCase() || '—'}</div>
                  {data.region && <div><strong>REGIÓN:</strong> {data.region}</div>}
                  {data.lateralidad && <div><strong>LATERALIDAD:</strong> {data.lateralidad.toUpperCase()}</div>}
                </div>
                <div style={{ padding: '12px 18px' }}>
                  <textarea
                    className="input"
                    style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: 14, lineHeight: 1.75, resize: 'vertical', minHeight: 280 }}
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => { setEditing(false); setEditText(data.diagnostico); }}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving || !editText.trim()}>
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="paper" style={{ maxWidth: 720, margin: '0 auto', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}>
                {/* Membrete Oficial */}
                <div className="header" style={{
                  background: 'linear-gradient(135deg,#003366,#0a4d8c)',
                  padding: '20px 24px', color: '#fff', borderTopLeftRadius: 8, borderTopRightRadius: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 56, height: 44, padding: '4px 6px', borderRadius: 10, background: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <img className="brand-img" src="/logo.png" alt={data.centro_nombre || 'RX CCDX'} onError={e => { e.target.style.display = 'none'; }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em' }}>{data.centro_nombre}</div>
                        <div style={{ fontSize: 11, opacity: 0.85, marginTop: 1 }}>Departamento de Radiología e Imágenes Diagnósticas</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 11, opacity: 0.85, lineHeight: 1.4 }}>
                      {data.centro_direccion && <div>{data.centro_direccion}</div>}
                      {data.centro_telefono && <div>Tel: {data.centro_telefono}</div>}
                      {data.centro_email && <div>{data.centro_email}</div>}
                    </div>
                  </div>
                </div>

                {/* Ficha completa del Paciente y Estudio */}
                <div style={{
                  padding: '16px 24px', borderBottom: '1px solid #e2e8f0',
                  fontFamily: '"Times New Roman", Times, serif', fontSize: 13, lineHeight: 1.85, color: '#374151',
                  background: '#f8fafc',
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
                    <div><strong>PACIENTE:</strong> <span style={{ color: '#0f172a', fontWeight: 700 }}>{data.paciente}</span></div>
                    <div><strong>REGISTRO:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{data.registro_id}</span></div>
                    <div><strong>EDAD / SEXO:</strong> {data.edad} años · {sexoLabel(data.sexo)}</div>
                    <div><strong>FECHA ESTUDIO:</strong> {data.fecha_estudio}</div>
                    {data.fecha_nacimiento && <div><strong>F. NACIMIENTO:</strong> {data.fecha_nacimiento}</div>}
                    {data.telefono && <div><strong>TELÉFONO:</strong> {data.telefono}</div>}
                    <div><strong>ESTUDIO:</strong> <span style={{ fontWeight: 600 }}>{data.tipo_estudio?.toUpperCase() || '—'}</span></div>
                    {data.region && <div><strong>REGIÓN ANATÓMICA:</strong> {data.region.toUpperCase()}</div>}
                    {data.lateralidad && <div><strong>LATERALIDAD:</strong> {data.lateralidad.toUpperCase()}</div>}
                    <div><strong>MÉDICO SOLICITANTE:</strong> {data.medico_remitente || 'No especificado'}</div>
                    {data.urgente ? (
                      <div><strong>PRIORIDAD:</strong> <span className="badge badge-red" style={{ fontSize: 9.5, padding: '1px 6px' }}>URGENTE</span></div>
                    ) : null}
                    {data.fecha_entrega_estimada && (
                      <div><strong>ENTREGA ESTIMADA:</strong> {data.fecha_entrega_estimada}</div>
                    )}
                  </div>
                  {data.notas_clinicas && (
                    <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px dashed #cbd5e1', fontSize: 12.5 }}>
                      <strong>INDICACIÓN CLÍNICA:</strong> <em>{data.notas_clinicas}</em>
                    </div>
                  )}
                </div>

                {/* Diagnóstico */}
                <div style={{ padding: '22px 28px 28px', background: '#fff' }}>
                  <div style={{
                    textAlign: 'center', fontWeight: 700, fontSize: 12,
                    textTransform: 'uppercase', letterSpacing: '0.12em',
                    color: '#003366', marginBottom: 18,
                    paddingBottom: 8, borderBottom: '2px solid #e2e8f0',
                  }}>
                    Informe e Interpretación Radiológica
                  </div>
                  <div style={{
                    fontFamily: '"Times New Roman", Times, serif',
                    fontSize: 14.5, lineHeight: 1.85, color: '#111827',
                    whiteSpace: 'pre-wrap', minHeight: 120,
                  }}>
                    {data.diagnostico}
                  </div>

                  {/* Firma */}
                  <div style={{ marginTop: 52, textAlign: 'center' }}>
                    <div style={{ borderTop: '1.5px solid #1e293b', width: 220, margin: '0 auto 8px' }} />
                    <div style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>
                      {data.radiologo_nombre || 'Dr. Alcántara'}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#64748b' }}>
                      Médico Radiólogo · Especialista en Imágenes Diagnósticas
                    </div>
                  </div>

                  {/* Pie */}
                  {data.informe_pie && (
                    <div style={{ marginTop: 24, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, borderTop: '1px solid #e2e8f0' }}>
                      <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6, textAlign: 'center', fontStyle: 'italic', margin: 0 }}>
                        {data.informe_pie}
                      </p>
                    </div>
                  )}

                  {/* Nota de trazabilidad */}
                  {data.estado && (
                    <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94a3b8' }}>
                      <Icon name="info" size={12} color="#94a3b8" />
                      Estado: {data.estado} · Fecha: {data.fecha_estudio}
                      {data.estado === 'Entregado' && ' · Entregado al paciente'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InformeViewer;
