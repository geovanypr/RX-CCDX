import{a as e,i as t,l as n,n as r,o as i,t as a}from"./Icons-8F0RzYb5.js";import{c as o,u as s}from"./index-DB1ELVDS.js";var c=n(i(),1),l=e(),u=({estudio:e,userRole:n,onClose:i,onSaved:u,autoPrint:d=!1})=>{let{user:f}=(0,c.useContext)(s),[p,m]=(0,c.useState)(null),[h,g]=(0,c.useState)(!0),[_,v]=(0,c.useState)(!1),[y,b]=(0,c.useState)(``),[x,S]=(0,c.useState)(!1),C=(0,c.useRef)(!1),w={Authorization:`Bearer ${f.token}`},T=n===`ENCARGADO`||n===`SUPER_ADMIN`,E=n===`RADIOLOGO`||n===`SUPER_ADMIN`;(0,c.useEffect)(()=>{fetch(`${r}/api/estudios/${e.id}/informe/preview`,{headers:w}).then(e=>e.json()).then(e=>{m(e),b(e.diagnostico||``)}).catch(()=>{}).finally(()=>g(!1))},[e.id]),(0,c.useEffect)(()=>{let e=e=>{e.key===`Escape`&&i()};return window.addEventListener(`keydown`,e),()=>window.removeEventListener(`keydown`,e)},[i]);let D=()=>{if(!p)return;let e=new Date().toLocaleDateString(`es-HN`,{year:`numeric`,month:`long`,day:`numeric`}),t=`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Informe Radiológico — ${p.registro_id} — ${p.paciente}</title>
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
              <img src="/logo.png" class="brand-logo" alt="${p.centro_nombre||`RX CCDX`}" onerror="this.style.display='none'" />
              <div>
                <h1 class="brand-title">${p.centro_nombre||`RX CCDX`}</h1>
                <p class="brand-subtitle">Departamento de Radiología e Imágenes Diagnósticas</p>
                ${p.centro_rnc?`<p class="brand-subtitle" style="font-size:8pt">RNC: ${p.centro_rnc}</p>`:``}
              </div>
            </div>
            <div class="center-contact">
              ${p.centro_direccion?`<div>${p.centro_direccion}</div>`:``}
              ${p.centro_telefono?`<div>Tel: ${p.centro_telefono}</div>`:``}
              ${p.centro_email?`<div>${p.centro_email}</div>`:``}
              <div style="font-weight:bold; margin-top:2px;">Fecha de emisión: ${e}</div>
            </div>
          </div>

          <!-- Título del documento -->
          <div class="doc-title">INFORME RADIOLÓGICO</div>

          <!-- Ficha de Datos del Paciente y Estudio -->
          <div class="patient-card">
            <div class="grid-2">
              <div class="field-row">
                <span class="field-label">Paciente:</span>
                <span class="field-value" style="font-weight:bold; font-size:10pt;">${p.paciente}</span>
              </div>
              <div class="field-row">
                <span class="field-label">No. Registro:</span>
                <span class="field-value field-mono">${p.registro_id}</span>
              </div>
              <div class="field-row">
                <span class="field-label">Edad / Sexo:</span>
                <span class="field-value">${p.edad} años · ${o(p.sexo)}</span>
              </div>
              <div class="field-row">
                <span class="field-label">Fecha del estudio:</span>
                <span class="field-value">${p.fecha_estudio||`—`}</span>
              </div>
              ${p.fecha_nacimiento?`
              <div class="field-row">
                <span class="field-label">F. Nacimiento:</span>
                <span class="field-value">${p.fecha_nacimiento}</span>
              </div>`:``}
              ${p.telefono?`
              <div class="field-row">
                <span class="field-label">Teléfono:</span>
                <span class="field-value">${p.telefono}</span>
              </div>`:``}
              <div class="field-row">
                <span class="field-label">Estudio realizado:</span>
                <span class="field-value" style="font-weight:600;">${p.tipo_estudio?.toUpperCase()||`—`}</span>
              </div>
              ${p.region?`
              <div class="field-row">
                <span class="field-label">Región anatómica:</span>
                <span class="field-value">${p.region.toUpperCase()}</span>
              </div>`:``}
              ${p.lateralidad?`
              <div class="field-row">
                <span class="field-label">Lateralidad:</span>
                <span class="field-value">${p.lateralidad.toUpperCase()}</span>
              </div>`:``}
              <div class="field-row">
                <span class="field-label">Médico remitente:</span>
                <span class="field-value">${p.medico_remitente||`No especificado`}</span>
              </div>
              ${p.urgente?`
              <div class="field-row">
                <span class="field-label">Prioridad:</span>
                <span class="field-value"><span class="urgent-tag">URGENTE</span></span>
              </div>`:``}
              ${p.fecha_entrega_estimada?`
              <div class="field-row">
                <span class="field-label">Fecha de entrega:</span>
                <span class="field-value">${p.fecha_entrega_estimada}</span>
              </div>`:``}
            </div>
            ${p.notas_clinicas?`
              <div class="field-row" style="margin-top:6px; padding-top:6px; border-top:1px dashed #e2e8f0;">
                <span class="field-label">Indicación clínica:</span>
                <span class="field-value" style="font-style:italic;">${p.notas_clinicas}</span>
              </div>
            `:``}
          </div>

          <!-- Hallazgos y Diagnóstico -->
          <div class="section-heading">Hallazgos e Interpretación Radiológica</div>
          <div class="diagnostico-content">${p.diagnostico}</div>

          <!-- Firma y Sello del Radiólogo -->
          <div class="signature-wrapper">
            <div class="signature-line"></div>
            <div class="doctor-name">${p.radiologo_nombre||`Dr. Alcántara`}</div>
            <div class="doctor-specialty">Médico Radiólogo · Especialista en Imágenes Diagnósticas</div>
            <div class="stamp-box">Documento electrónico validado por el centro radiológico</div>
          </div>

          <!-- Pie de página institucional -->
          <div class="report-footer">
            ${p.informe_pie||`Este informe radiológico es confidencial y para uso exclusivo del médico tratante y del paciente.`}
            <div style="margin-top:2px; font-size:7.5pt; opacity:0.8;">
              RX CCDX · Registro: ${p.registro_id} · ${e}
            </div>
          </div>
        </div>
      </body>
      </html>
    `,n=document.getElementById(`print-report-iframe`);n||(n=document.createElement(`iframe`),n.id=`print-report-iframe`,n.style.position=`fixed`,n.style.right=`0`,n.style.bottom=`0`,n.style.width=`0`,n.style.height=`0`,n.style.border=`0`,document.body.appendChild(n));let r=n.contentWindow.document;r.open(),r.write(t),r.close(),setTimeout(()=>{try{n.contentWindow.focus(),n.contentWindow.print()}catch{let e=window.open(``,`_blank`);e&&(e.document.open(),e.document.write(t),e.document.close(),e.onload=()=>{e.focus(),e.print()},e.document.readyState===`complete`&&(e.focus(),e.print()))}},250)};return(0,c.useEffect)(()=>{d&&p?.diagnostico&&!C.current&&(C.current=!0,D())},[d,p]),(0,l.jsx)(`div`,{className:`modal-backdrop`,onClick:i,children:(0,l.jsxs)(`div`,{className:`modal`,style:{maxWidth:840,maxHeight:`96vh`},onClick:e=>e.stopPropagation(),children:[(0,l.jsxs)(`div`,{className:`modal-header`,children:[(0,l.jsx)(`div`,{style:{width:44,height:44,borderRadius:12,flexShrink:0,background:`linear-gradient(135deg,#eff6ff,#dbeafe)`,display:`flex`,alignItems:`center`,justifyContent:`center`},children:(0,l.jsx)(a,{name:`fileText`,size:22,color:`#1a66b3`})}),(0,l.jsxs)(`div`,{className:`flex-1`,children:[(0,l.jsxs)(`div`,{style:{display:`flex`,alignItems:`center`,gap:8,flexWrap:`wrap`},children:[(0,l.jsx)(`span`,{style:{fontWeight:700,fontSize:15,color:`var(--color-primary)`},children:`Informe Radiológico`}),p&&(0,l.jsx)(`span`,{className:`chip mono`,children:p.registro_id}),p?.urgente&&(0,l.jsx)(`span`,{className:`badge badge-red`,style:{fontSize:9.5,padding:`2px 7px`},children:`URGENTE`})]}),(0,l.jsxs)(`p`,{style:{fontSize:12.5,color:`var(--color-text-muted)`,marginTop:2},children:[e.nombre,` · `,e.tipo_estudio]})]}),(0,l.jsxs)(`div`,{style:{display:`flex`,gap:6,flexWrap:`wrap`,alignItems:`center`},children:[p?.diagnostico&&!_&&(0,l.jsxs)(l.Fragment,{children:[(T||E)&&(0,l.jsxs)(`button`,{className:`btn btn-ghost btn-sm`,onClick:()=>v(!0),style:{gap:5},children:[(0,l.jsx)(a,{name:`edit`,size:13}),` Editar`]}),(0,l.jsxs)(`button`,{className:`btn btn-success btn-sm`,onClick:D,style:{gap:5},children:[(0,l.jsx)(a,{name:`print`,size:13}),` Imprimir Todo`]}),(0,l.jsxs)(`button`,{className:`btn btn-secondary btn-sm`,onClick:async()=>{try{await t(`/api/estudios/${e.id}/informe/download`,f.token,`Informe_${e.nombre}_${p?.registro_id||`estudio`}.docx`)}catch{}},style:{gap:5},children:[(0,l.jsx)(a,{name:`download`,size:13}),` Word`]}),(0,l.jsxs)(`button`,{className:`btn btn-ghost btn-sm`,onClick:async()=>{try{await t(`/api/estudios/${e.id}/export`,f.token,`${e.nombre}_${p?.registro_id||`estudio`}.zip`)}catch{}},style:{gap:5},children:[(0,l.jsx)(a,{name:`download`,size:13}),` ZIP`]})]}),(0,l.jsx)(`button`,{className:`modal-close`,onClick:i,children:(0,l.jsx)(a,{name:`close`,size:18})})]})]}),(0,l.jsx)(`div`,{className:`modal-body`,style:{background:`#e8ecf3`,padding:`20px 24px`,overflowY:`auto`},children:h?(0,l.jsx)(`div`,{style:{display:`flex`,justifyContent:`center`,padding:60},children:(0,l.jsx)(`div`,{className:`spinner`})}):p?.diagnostico?_?(0,l.jsxs)(`div`,{style:{display:`flex`,flexDirection:`column`,gap:12},children:[(0,l.jsxs)(`div`,{className:`paper`,style:{flex:1},children:[(0,l.jsx)(`div`,{className:`paper-letterhead`,style:{padding:`14px 18px`},children:(0,l.jsx)(`div`,{style:{fontWeight:700,fontSize:14},children:p.centro_nombre})}),(0,l.jsxs)(`div`,{style:{padding:`14px 18px`,borderBottom:`1px solid #e2e8f0`,fontFamily:`"Times New Roman", Times, serif`,fontSize:12.5,lineHeight:1.9},children:[(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`strong`,{children:`PACIENTE:`}),` `,p.paciente]}),(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`strong`,{children:`REGISTRO:`}),` `,p.registro_id]}),(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`strong`,{children:`ESTUDIO:`}),` `,p.tipo_estudio?.toUpperCase()||`—`]}),p.region&&(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`strong`,{children:`REGIÓN:`}),` `,p.region]}),p.lateralidad&&(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`strong`,{children:`LATERALIDAD:`}),` `,p.lateralidad.toUpperCase()]})]}),(0,l.jsx)(`div`,{style:{padding:`12px 18px`},children:(0,l.jsx)(`textarea`,{className:`input`,style:{fontFamily:`"Times New Roman", Times, serif`,fontSize:14,lineHeight:1.75,resize:`vertical`,minHeight:280},value:y,onChange:e=>b(e.target.value),autoFocus:!0})})]}),(0,l.jsxs)(`div`,{style:{display:`flex`,gap:8,justifyContent:`flex-end`},children:[(0,l.jsx)(`button`,{className:`btn btn-ghost`,onClick:()=>{v(!1),b(p.diagnostico)},children:`Cancelar`}),(0,l.jsx)(`button`,{className:`btn btn-primary`,onClick:async()=>{if(!y.trim())return;S(!0);let t=E?`POST`:`PUT`;try{(await(await fetch(`http://localhost:3002/api/estudios/${e.id}/diagnostico`,{method:t,headers:{...w,"Content-Type":`application/json`},body:JSON.stringify({diagnostico:y})})).json()).success&&(m(e=>({...e,diagnostico:y})),v(!1),u?.())}finally{S(!1)}},disabled:x||!y.trim(),children:x?`Guardando...`:`Guardar cambios`})]})]}):(0,l.jsx)(`div`,{children:(0,l.jsxs)(`div`,{className:`paper`,style:{maxWidth:720,margin:`0 auto`,boxShadow:`0 8px 30px rgba(0,0,0,0.12)`},children:[(0,l.jsx)(`div`,{className:`header`,style:{background:`linear-gradient(135deg,#003366,#0a4d8c)`,padding:`20px 24px`,color:`#fff`,borderTopLeftRadius:8,borderTopRightRadius:8},children:(0,l.jsxs)(`div`,{style:{display:`flex`,alignItems:`center`,justifyContent:`space-between`,gap:12,flexWrap:`wrap`},children:[(0,l.jsxs)(`div`,{style:{display:`flex`,alignItems:`center`,gap:12},children:[(0,l.jsx)(`div`,{style:{width:56,height:44,padding:`4px 6px`,borderRadius:10,background:`rgba(255,255,255,0.95)`,display:`flex`,alignItems:`center`,justifyContent:`center`,flexShrink:0},children:(0,l.jsx)(`img`,{className:`brand-img`,src:`/logo.png`,alt:p.centro_nombre||`RX CCDX`,onError:e=>{e.target.style.display=`none`}})}),(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`div`,{style:{fontSize:17,fontWeight:800,letterSpacing:`-0.01em`},children:p.centro_nombre}),(0,l.jsx)(`div`,{style:{fontSize:11,opacity:.85,marginTop:1},children:`Departamento de Radiología e Imágenes Diagnósticas`})]})]}),(0,l.jsxs)(`div`,{style:{textAlign:`right`,fontSize:11,opacity:.85,lineHeight:1.4},children:[p.centro_direccion&&(0,l.jsx)(`div`,{children:p.centro_direccion}),p.centro_telefono&&(0,l.jsxs)(`div`,{children:[`Tel: `,p.centro_telefono]}),p.centro_email&&(0,l.jsx)(`div`,{children:p.centro_email})]})]})}),(0,l.jsxs)(`div`,{style:{padding:`16px 24px`,borderBottom:`1px solid #e2e8f0`,fontFamily:`"Times New Roman", Times, serif`,fontSize:13,lineHeight:1.85,color:`#374151`,background:`#f8fafc`},children:[(0,l.jsxs)(`div`,{style:{display:`grid`,gridTemplateColumns:`1fr 1fr`,gap:`4px 24px`},children:[(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`strong`,{children:`PACIENTE:`}),` `,(0,l.jsx)(`span`,{style:{color:`#0f172a`,fontWeight:700},children:p.paciente})]}),(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`strong`,{children:`REGISTRO:`}),` `,(0,l.jsx)(`span`,{style:{fontFamily:`monospace`,fontWeight:700},children:p.registro_id})]}),(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`strong`,{children:`EDAD / SEXO:`}),` `,p.edad,` años · `,o(p.sexo)]}),(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`strong`,{children:`FECHA ESTUDIO:`}),` `,p.fecha_estudio]}),p.fecha_nacimiento&&(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`strong`,{children:`F. NACIMIENTO:`}),` `,p.fecha_nacimiento]}),p.telefono&&(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`strong`,{children:`TELÉFONO:`}),` `,p.telefono]}),(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`strong`,{children:`ESTUDIO:`}),` `,(0,l.jsx)(`span`,{style:{fontWeight:600},children:p.tipo_estudio?.toUpperCase()||`—`})]}),p.region&&(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`strong`,{children:`REGIÓN ANATÓMICA:`}),` `,p.region.toUpperCase()]}),p.lateralidad&&(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`strong`,{children:`LATERALIDAD:`}),` `,p.lateralidad.toUpperCase()]}),(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`strong`,{children:`MÉDICO SOLICITANTE:`}),` `,p.medico_remitente||`No especificado`]}),p.urgente?(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`strong`,{children:`PRIORIDAD:`}),` `,(0,l.jsx)(`span`,{className:`badge badge-red`,style:{fontSize:9.5,padding:`1px 6px`},children:`URGENTE`})]}):null,p.fecha_entrega_estimada&&(0,l.jsxs)(`div`,{children:[(0,l.jsx)(`strong`,{children:`ENTREGA ESTIMADA:`}),` `,p.fecha_entrega_estimada]})]}),p.notas_clinicas&&(0,l.jsxs)(`div`,{style:{marginTop:8,paddingTop:6,borderTop:`1px dashed #cbd5e1`,fontSize:12.5},children:[(0,l.jsx)(`strong`,{children:`INDICACIÓN CLÍNICA:`}),` `,(0,l.jsx)(`em`,{children:p.notas_clinicas})]})]}),(0,l.jsxs)(`div`,{style:{padding:`22px 28px 28px`,background:`#fff`},children:[(0,l.jsx)(`div`,{style:{textAlign:`center`,fontWeight:700,fontSize:12,textTransform:`uppercase`,letterSpacing:`0.12em`,color:`#003366`,marginBottom:18,paddingBottom:8,borderBottom:`2px solid #e2e8f0`},children:`Informe e Interpretación Radiológica`}),(0,l.jsx)(`div`,{style:{fontFamily:`"Times New Roman", Times, serif`,fontSize:14.5,lineHeight:1.85,color:`#111827`,whiteSpace:`pre-wrap`,minHeight:120},children:p.diagnostico}),(0,l.jsxs)(`div`,{style:{marginTop:52,textAlign:`center`},children:[(0,l.jsx)(`div`,{style:{borderTop:`1.5px solid #1e293b`,width:220,margin:`0 auto 8px`}}),(0,l.jsx)(`div`,{style:{fontFamily:`"Times New Roman", Times, serif`,fontSize:13.5,fontWeight:700,color:`#0f172a`},children:p.radiologo_nombre||`Dr. Alcántara`}),(0,l.jsx)(`div`,{style:{fontSize:11.5,color:`#64748b`},children:`Médico Radiólogo · Especialista en Imágenes Diagnósticas`})]}),p.informe_pie&&(0,l.jsx)(`div`,{style:{marginTop:24,padding:`10px 14px`,background:`#f8fafc`,borderRadius:8,borderTop:`1px solid #e2e8f0`},children:(0,l.jsx)(`p`,{style:{fontSize:11,color:`#64748b`,lineHeight:1.6,textAlign:`center`,fontStyle:`italic`,margin:0},children:p.informe_pie})}),p.estado&&(0,l.jsxs)(`div`,{style:{marginTop:16,display:`flex`,alignItems:`center`,gap:6,fontSize:11,color:`#94a3b8`},children:[(0,l.jsx)(a,{name:`info`,size:12,color:`#94a3b8`}),`Estado: `,p.estado,` · Fecha: `,p.fecha_estudio,p.estado===`Entregado`&&` · Entregado al paciente`]})]})]})}):(0,l.jsxs)(`div`,{className:`empty-state`,style:{padding:48},children:[(0,l.jsx)(`div`,{style:{marginBottom:12},children:(0,l.jsx)(a,{name:`fileText`,size:44,color:`#94a3b8`})}),(0,l.jsx)(`h4`,{children:`Sin diagnóstico emitido`}),(0,l.jsx)(`p`,{children:`El radiólogo no ha emitido el diagnóstico de este estudio aún.`})]})})]})})};export{u as default};