/**
 * Ortografía: reglas deterministas para español + integración opcional
 * con LanguageTool (self-hosted) si LANGUAGE_TOOL_URL está configurado.
 */

// Errores ortográficos frecuentes en español (muestra de reglas de alta precisión)
const COMMON_MISSPELLINGS = new Map([
  ['haber', null], // marcador, no error; se usa como referencia abajo
  ['asta', 'hasta'], ['ablar', 'hablar'], ['agusto', 'agosto'],
  ['ai', 'ahí'], ['aora', 'ahora'], ['ayudar', null],
  ['bello', null], ['bibe', 'vive'], ['callo', null],
  ['cebo', null], ['cinco', null], ['ciudad', null],
  ['de acuedo', 'de acuerdo'], ['de repente', null],
  ['echo', null], ['empecé', null], ['entons', 'entonces'], ['entonses', 'entonces'],
  ['examinacion', 'examinación'], ['experiencia', null],
  ['facil', 'fácil'], ['fabor', 'favor'], ['fue', null],
  ['gobierno', null], ['gusta', null],
  ['haber si', 'a ver si'], ['haber echo', 'haber hecho'],
  ['imbecible', 'imbécil'], ['imformación', 'información'], ['imposible', null],
  ['invencible', null], ['iva', 'iba'],
  ['kiero', 'quiero'], ['kiero', 'quiero'],
  ['llamar', null], ['llueve', null],
  ['màquina', 'máquina'], ['mal', null], ['mas', 'más'],
  ['medico', 'médico'], ['mejico', 'México'], ['menejar', 'manejar'],
  ['nación', 'nación'], ['niño', null],
  ['ojala', 'ojalá'], ['ortografia', 'ortografía'],
  ['pagina', 'página'], ['palacio', null], ['paises', 'países'],
  ['perdida', 'pérdida'], ['perdon', 'perdón'],
  ['que', null], ['qeu', 'que'], ['qie', 'que'],
  ['recien', 'recién'], ['redaccion', 'redacción'],
  ['sabanas', 'sábanas'], ['sabado', 'sábado'], ['salir', null],
  ['save', 'sabe'], ['sentido', null], ['si', null], ['silo', 'siglo'],
  ['sistema', null], ['solo', null], ['subraye', 'subrayé'],
  ['tambien', 'también'], ['tancion', 'tensión'], ['tendencia', null],
  ['telefono', 'teléfono'], ['tengais', 'tengáis'],
  ['tubo', null], ['ultimo', 'último'],
  ['valla', null], ['valla', 'vaya'], ['valla', 'baya'],
  ['varon', 'varón'], ['vender', null], ['ves', 'vez'],
  ['voltear', 'voltear'],
  ['xq', 'porque'], ['xk', 'porque'],
  ['yegua', null], ['yoga', null],
  ['zoo', null]
].filter(([, v]) => v !== null));

// Palabras que pierden tilde con frecuencia (detector de tilde faltante, contexto simple)
const COMMON_UNACCENTED = new Map([
  ['mas', 'más'], ['el', 'él'], ['si', 'sí'], ['tu', 'tú'], ['mi', 'mí'],
  ['se', 'sé'], ['de', 'dé'], ['te', 'té'], ['solo', 'sólo'],
  ['esta', 'está'], ['estan', 'están'], ['estan', 'están'],
  ['aun', 'aún'], ['medico', 'médico'], ['pagina', 'página'],
  ['examen', 'exámenes'], ['joven', 'jóvenes'], ['origen', 'orígenes'],
  ['imagen', 'imágenes'], ['limon', 'limón'], ['cancion', 'canción'],
  ['corazon', 'corazón'], ['razon', 'razón'], ['atencion', 'atención'],
  ['informacion', 'información'], ['educacion', 'educación'],
  ['evaluacion', 'evaluación'], ['investigacion', 'investigación'],
  ['metodologia', 'metodología'], ['estadistica', 'estadística'],
  ['analisis', 'análisis'], ['diagnostico', 'diagnóstico'],
  ['farmacia', 'farmacéutica'], ['universidad', 'universidad'],
  ['facil', 'fácil'], ['dificil', 'difícil'], ['util', 'útil'],
  ['movil', 'móvil'], ['docil', 'dócil'], ['agil', 'ágil'],
  ['fragil', 'frágil'], ['sutil', 'sutil'],
  ['tambien', 'también'], ['jamas', 'jamás'], ['quizas', 'quizás'],
  ['ingles', 'inglés'], ['frances', 'francés'], ['portugues', 'portugués'],
  ['aleman', 'alemán'], ['japon', 'Japón'], ['cancion', 'canción'],
  ['canciones', 'canciones'], ['leccion', 'lección'], ['lecciones', 'lecciones'],
  ['opcion', 'opción'], ['opciones', 'opciones'], ['nacion', 'nación'],
  ['naciones', 'naciones'], ['atencion', 'atención'], ['atenciones', 'atenciones']
]);

// Palabras funcionales frecuentes exentas de corrector básico
const STOPWORDS = new Set([
  'de', 'la', 'el', 'en', 'y', 'a', 'los', 'las', 'un', 'una', 'del', 'al', 'por', 'para', 'con', 'sin', 'sobre', 'entre', 'hasta', 'desde',
  'es', 'son', 'fue', 'fueron', 'ser', 'estar', 'esta', 'este', 'estos', 'estas', 'esa', 'ese', 'eso', 'como', 'más', 'pero', 'porque', 'si', 'no', 'sí',
  'se', 'su', 'sus', 'lo', 'le', 'les', 'me', 'te', 'nos', 'os', 'mi', 'tu', 'mis', 'tus', 'nuestro', 'nuestra', 'ellos', 'ellas', 'usted', 'ustedes',
  'que', 'quien', 'cual', 'cuyo', 'donde', 'cuando', 'cuanto', 'todo', 'toda', 'todos', 'todas', 'otro', 'otra', 'mucho', 'poco', 'algo', 'nada',
  'hay', 'ha', 'han', 'habia', 'habían', 'tiene', 'tienen', 'hacer', 'hecho', 'puede', 'pueden', 'debe', 'deben', 'va', 'van', 'dio', 'dar',
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'have', 'has', 'are', 'was', 'were', 'been', 'will', 'would', 'can', 'could'
]);

const SPANISH_CHARS = /^[a-záéíóúüñ]+$/i;

function tokenizeWithPositions(text) {
  const tokens = [];
  const re = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:'[a-z]+)?/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    tokens.push({ word: m[0], index: m.index, lower: m[0].toLowerCase() });
  }
  return tokens;
}

function checkOrthography(text, languageToolUrl = null) {
  const errors = [];
  const tokens = tokenizeWithPositions(text);
  const lowerText = text.toLowerCase();

  // 1. Errores ortográficos conocidos (multi-palabra primero)
  for (const [wrong, correct] of COMMON_MISSPELLINGS) {
    const re = new RegExp(`\\b${escapeRegExp(wrong)}\\b`, 'gi');
    let m;
    while ((m = re.exec(text)) !== null) {
      errors.push({
        type: 'ortografia',
        message: `Posible error: "${m[0]}" → sugerencia: "${correct}"`,
        index: m.index,
        severity: 'alta'
      });
    }
  }

  // 2. Palabras repetidas consecutivas ("la la", "de de")
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i].lower === tokens[i - 1].lower && tokens[i].lower.length > 2) {
      errors.push({
        type: 'ortografia',
        message: `Palabra duplicada: "${tokens[i].word}"`,
        index: tokens[i].index,
        severity: 'media'
      });
    }
  }

  // 3. Tildes faltantes frecuentes (heurística: palabra exacta sin tilde en contexto ambiguo)
  for (const tok of tokens) {
    const sug = COMMON_UNACCENTED.get(tok.lower);
    if (sug && !STOPWORDS.has(tok.lower)) {
      // Solo reportar las que son inequívocas como error típico
      const unequivocal = ['examinacion', 'ortografia', 'redaccion', 'informacion', 'educacion', 'evaluacion', 'investigacion',
        'metodologia', 'estadistica', 'diagnostico', 'telefono', 'pagina', 'corazon', 'razon', 'atencion', 'tambien',
        'medico', 'facil', 'dificil', 'ingles', 'frances', 'leccion', 'opcion', 'nacion', 'jamas', 'quizas', 'recien',
        'ultimo', 'varon', 'paises', 'imformacion', 'kiero', 'qeu', 'entons', 'subraye', 'ojala', 'save', 'mas', 'ves'];
      if (unequivocal.includes(tok.lower)) {
        errors.push({
          type: 'ortografia',
          message: `Posible tilde faltante: "${tok.word}" → "${sug}"`,
          index: tok.index,
          severity: 'media'
        });
      }
    }
  }

  // 4. Doble espacio / espacio antes de puntuación / falta de espacio después de puntuación
  let m;
  const doubleSpace = / {2,}/g;
  while ((m = doubleSpace.exec(text)) !== null) {
    errors.push({ type: 'presentacion', message: 'Doble espacio detectado', index: m.index, severity: 'baja' });
  }
  const spaceBeforePunct = /\s+[,.!?;:%]/g;
  while ((m = spaceBeforePunct.exec(text)) !== null) {
    errors.push({ type: 'ortografia', message: `Espacio antes de puntuación "${m[0].trim()}"`, index: m.index, severity: 'baja' });
  }
  const noSpaceAfter = /[.!?;:][A-ZÁÉÍÓÚÑ]/g;
  while ((m = noSpaceAfter.exec(text)) !== null) {
    errors.push({ type: 'presentacion', message: `Falta espacio después de puntuación en "${m[0]}"`, index: m.index, severity: 'baja' });
  }

  // 5. Letras duplicadas raras ("qeu", consonantes triples)
  const tripleConsonant = /([bcdfghjklmnpqrstvwxz])\1\1+/gi;
  while ((m = tripleConsonant.exec(text)) !== null) {
    errors.push({ type: 'ortografia', message: `Consonante repetida "${m[0]}"`, index: m.index, severity: 'media' });
  }

  return { errors, external: null };
}

async function checkWithLanguageTool(text, baseUrl, language = 'es') {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/v2/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ text, language })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.matches || []).map((match) => ({
      type: 'ortografia',
      message: match.message || 'Error ortográfico',
      index: match.offset,
      suggestion: match.replacements?.[0]?.value,
      severity: match.rule?.issueType === 'misspelling' ? 'alta' : 'media',
      source: 'languagetool'
    }));
  } catch {
    return null; // LanguageTool no disponible: continuar con reglas locales
  }
}

function scoreOrthography(errors, wordCount) {
  // Penalización por error; normalizada por cada 500 palabras
  const penalty = Math.min(100, (errors.length / Math.max(wordCount, 1)) * 500 * 6);
  const score = Math.max(0, Math.round(100 - penalty));
  return {
    score,
    label: score >= 80 ? 'correcto' : score >= 60 ? 'con_observaciones' : 'con_errores',
    errors: errors.slice(0, 200),
    totalErrors: errors.length
  };
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { checkOrthography, checkWithLanguageTool, scoreOrthography, tokenizeWithPositions };
