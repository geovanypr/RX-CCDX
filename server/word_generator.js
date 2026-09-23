const fs = require('fs');
const path = require('path');
const docx = require('docx');
const { Document, Packer, Paragraph, TextRun, AlignmentType } = docx;

async function generateWordReport(patientPath, data) {
  // data = { estudioId, fecha, pacienteNombre, pacienteEdad, tipoEstudio, medicoRemitente, diagnostico, radiologo, config }
  const cfg = data.config || {};
  const centroNombre = cfg.centro_nombre || 'RX CCDX';
  const centroDireccion = cfg.centro_direccion || '';
  const centroTelefono = cfg.centro_telefono || '';
  const centroEmail = cfg.centro_email || '';
  const informePie = cfg.informe_pie || '';

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // ===== Membrete institucional =====
          new Paragraph({
            text: centroNombre,
            alignment: AlignmentType.CENTER,
            style: 'TituloCentro',
          }),
          new Paragraph({
            text: "_________________________________________________________________",
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),
          // ===== Datos del paciente =====
          new Paragraph({
            children: [
              new TextRun({ text: "FECHA: ", bold: true }),
              new TextRun(data.fecha),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "NOMBRE DEL PACIENTE: ", bold: true }),
              new TextRun(data.pacienteNombre),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "EDAD: ", bold: true }),
              new TextRun(data.pacienteEdad + " AÑOS"),
            ],
          }),
          ...(data.tipoEstudio ? [new Paragraph({
            children: [
              new TextRun({ text: "ESTUDIO: ", bold: true }),
              new TextRun(data.tipoEstudio.toUpperCase()),
            ],
          })] : []),
          ...(data.region ? [new Paragraph({
            children: [
              new TextRun({ text: "REGIÓN ANATÓMICA: ", bold: true }),
              new TextRun(data.region.toUpperCase()),
            ],
          })] : []),
          ...(data.lateralidad ? [new Paragraph({
            children: [
              new TextRun({ text: "LATERALIDAD: ", bold: true }),
              new TextRun(data.lateralidad.toUpperCase()),
            ],
          })] : []),
          ...(data.medicoRemitente ? [new Paragraph({
            children: [
              new TextRun({ text: "MÉDICO REMITENTE: ", bold: true }),
              new TextRun(data.medicoRemitente),
            ],
          })] : []),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [
              new TextRun({ text: "===========================================================", bold: true }),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [
              new TextRun({ text: "Diagnóstico", bold: true, size: 28 }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "" }),
          ...data.diagnostico.split('\n').map(line => new Paragraph({ text: line })),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),
          new Paragraph({
            text: "___________________________",
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: "Dr. Alcántara",
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: "Firma y Sello del Médico Radiólogo",
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "" }),
          ...(informePie ? [new Paragraph({
            text: informePie,
            style: 'Institution',
          })] : []),
        ],
      },
    ],
    styles: {
      default: {
        document: { run: { font: 'Times New Roman', size: 24 } },
      },
      paragraphStyles: [
        {
          id: 'TituloCentro',
          name: 'TituloCentro',
          basedOn: 'Normal',
          run: { size: 36, bold: true, color: '003366' },
          paragraph: { spacing: { after: 120 } },
        },
        {
          id: 'Institution',
          name: 'Institution',
          basedOn: 'Normal',
          run: { size: 18, italics: true, color: '444444' },
          paragraph: { spacing: { after: 60 } },
        },
      ],
    },
  });

  const suffix = data.estudioId ? `_Estudio_${data.estudioId}` : '';
  const reportName = `Informe_${data.pacienteNombre.replace(/[^a-z0-9]/gi, '_')}${suffix}.docx`;
  const reportPath = path.join(patientPath, reportName);

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(reportPath, buffer);

  return reportPath;
}

module.exports = { generateWordReport };
