// Catálogo radiológico del sistema: tipos de estudio, región anatómica y la
// categoría de plantilla de informe que le corresponde. Alimenta el formulario de
// registro, el sugeridor de plantillas del radiólogo y los reportes por región.

export const REGIONES = [
  'Tórax',
  'Abdomen',
  'Columna cervical',
  'Columna dorsal',
  'Columna lumbosacra',
  'Pelvis',
  'Cadera',
  'Extremidad superior',
  'Extremidad inferior',
  'Cráneo',
  'Cuello',
  'Otra',
];

export const CATALOGO_ESTUDIOS = [
  { tipo: 'Tórax PA', region: 'Tórax', categoria: 'Tórax' },
  { tipo: 'Tórax PA-L (lateral)', region: 'Tórax', categoria: 'Tórax' },
  { tipo: 'Tórax AP portátil', region: 'Tórax', categoria: 'Tórax' },
  { tipo: 'Tórax óseo', region: 'Tórax', categoria: 'Tórax' },
  { tipo: 'Abdomen simple AP', region: 'Abdomen', categoria: 'Abdomen' },
  { tipo: 'Abdomen de pie (bipedestación)', region: 'Abdomen', categoria: 'Abdomen' },
  { tipo: 'Serie de abdomen obstructivo', region: 'Abdomen', categoria: 'Abdomen' },
  { tipo: 'Columna cervical AP', region: 'Columna cervical', categoria: 'Columna' },
  { tipo: 'Columna cervical lateral', region: 'Columna cervical', categoria: 'Columna' },
  { tipo: 'Columna cervical oblicua', region: 'Columna cervical', categoria: 'Columna' },
  { tipo: 'Columna dorsal AP', region: 'Columna dorsal', categoria: 'Columna' },
  { tipo: 'Columna dorsal lateral', region: 'Columna dorsal', categoria: 'Columna' },
  { tipo: 'Columna lumbosacra AP', region: 'Columna lumbosacra', categoria: 'Columna' },
  { tipo: 'Columna lumbosacra lateral', region: 'Columna lumbosacra', categoria: 'Columna' },
  { tipo: 'Columna lumbosacra oblicua', region: 'Columna lumbosacra', categoria: 'Columna' },
  { tipo: 'Pelvis AP', region: 'Pelvis', categoria: 'Abdomen' },
  { tipo: 'Cadera AP', region: 'Cadera', categoria: 'Extremidades' },
  { tipo: 'Cadera derecha', region: 'Cadera', categoria: 'Extremidades' },
  { tipo: 'Cadera izquierda', region: 'Cadera', categoria: 'Extremidades' },
  { tipo: 'Ambas caderas', region: 'Cadera', categoria: 'Extremidades' },
  { tipo: 'Hombro derecho', region: 'Extremidad superior', categoria: 'Extremidades' },
  { tipo: 'Hombro izquierdo', region: 'Extremidad superior', categoria: 'Extremidades' },
  { tipo: 'Ambos hombros', region: 'Extremidad superior', categoria: 'Extremidades' },
  { tipo: 'Brazo derecho', region: 'Extremidad superior', categoria: 'Extremidades' },
  { tipo: 'Brazo izquierdo', region: 'Extremidad superior', categoria: 'Extremidades' },
  { tipo: 'Ambos brazos', region: 'Extremidad superior', categoria: 'Extremidades' },
  { tipo: 'Codo derecho', region: 'Extremidad superior', categoria: 'Extremidades' },
  { tipo: 'Codo izquierdo', region: 'Extremidad superior', categoria: 'Extremidades' },
  { tipo: 'Ambos codos', region: 'Extremidad superior', categoria: 'Extremidades' },
  { tipo: 'Muñeca derecha', region: 'Extremidad superior', categoria: 'Extremidades' },
  { tipo: 'Muñeca izquierda', region: 'Extremidad superior', categoria: 'Extremidades' },
  { tipo: 'Ambas muñecas', region: 'Extremidad superior', categoria: 'Extremidades' },
  { tipo: 'Mano derecha', region: 'Extremidad superior', categoria: 'Extremidades' },
  { tipo: 'Mano izquierda', region: 'Extremidad superior', categoria: 'Extremidades' },
  { tipo: 'Ambas manos', region: 'Extremidad superior', categoria: 'Extremidades' },
  { tipo: 'Pierna derecha', region: 'Extremidad inferior', categoria: 'Extremidades' },
  { tipo: 'Pierna izquierda', region: 'Extremidad inferior', categoria: 'Extremidades' },
  { tipo: 'Ambas piernas', region: 'Extremidad inferior', categoria: 'Extremidades' },
  { tipo: 'Rodilla derecha', region: 'Extremidad inferior', categoria: 'Extremidades' },
  { tipo: 'Rodilla izquierda', region: 'Extremidad inferior', categoria: 'Extremidades' },
  { tipo: 'Ambas rodillas', region: 'Extremidad inferior', categoria: 'Extremidades' },
  { tipo: 'Tobillo derecho', region: 'Extremidad inferior', categoria: 'Extremidades' },
  { tipo: 'Tobillo izquierdo', region: 'Extremidad inferior', categoria: 'Extremidades' },
  { tipo: 'Ambos tobillos', region: 'Extremidad inferior', categoria: 'Extremidades' },
  { tipo: 'Pie derecho', region: 'Extremidad inferior', categoria: 'Extremidades' },
  { tipo: 'Pie izquierdo', region: 'Extremidad inferior', categoria: 'Extremidades' },
  { tipo: 'Ambos pies', region: 'Extremidad inferior', categoria: 'Extremidades' },
  { tipo: 'Fémur AP y lateral', region: 'Extremidad inferior', categoria: 'Extremidades' },
  { tipo: 'Húmero AP y lateral', region: 'Extremidad superior', categoria: 'Extremidades' },
  { tipo: 'Cráneo AP y lateral', region: 'Cráneo', categoria: 'Cráneo' },
  { tipo: 'Senos paranasales (Waters/Caldwell)', region: 'Cráneo', categoria: 'Cráneo' },
  { tipo: 'Cuello lateral', region: 'Cuello', categoria: 'Cráneo' },
  { tipo: 'Partes blandas de cuello', region: 'Cuello', categoria: 'Cráneo' },
  { tipo: 'Tórax pediátrico', region: 'Tórax', categoria: 'Pediátrica' },
  { tipo: 'Abdomen pediátrico', region: 'Abdomen', categoria: 'Pediátrica' },
];

const normalizar = (texto) => String(texto || '').trim().toLowerCase();

/** Devuelve la entrada del catálogo que corresponde al tipo de estudio (o null). */
export const buscarEnCatalogo = (tipo) => {
  const buscado = normalizar(tipo);
  if (!buscado) return null;
  return (
    CATALOGO_ESTUDIOS.find(entrada => normalizar(entrada.tipo) === buscado) ||
    CATALOGO_ESTUDIOS.find(entrada => normalizar(entrada.tipo).includes(buscado) || buscado.includes(normalizar(entrada.tipo))) ||
    null
  );
};

/** Región anatómica inferida del tipo de estudio (vacío si no se reconoce). */
export const regionDeTipo = (tipo) => buscarEnCatalogo(tipo)?.region || '';

/** Categoría de plantilla sugerida para el tipo de estudio. */
export const categoriaSugerida = (tipo) => buscarEnCatalogo(tipo)?.categoria || 'General';

/** Agrupa el catálogo por región para armar el selector del formulario. */
export const catalogoPorRegion = () =>
  REGIONES
    .map(region => ({ region, estudios: CATALOGO_ESTUDIOS.filter(e => e.region === region) }))
    .filter(grupo => grupo.estudios.length > 0);
