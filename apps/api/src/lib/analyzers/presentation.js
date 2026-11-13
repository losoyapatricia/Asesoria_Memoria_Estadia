/**
 * Presentación: evalúa estructura formal del documento académico
 * (título, secciones, numeración, resumen, referencias, formato básico).
 */

const SECTION_PATTERNS = [
  { key: 'resumen', re: /\b(resumen|abstract|sumary|sumario)\b/i },
  { key: 'introduccion', re: /\b(introducci[oó]n|antecedentes|marco te[oó]rico)\b/i },
  { key: 'objetivos', re: /\b(objetivos?|objetivo general|objetivos espec[ií]ficos)\b/i },
  { key: 'metodologia', re: /\b(metodolog[ií]a|m[eé]todos?|materiales?|procedimiento)\b/i },
  { key: 'resultados', re: /\b(resultados?|hallazgos|conclusiones?)\b/i },
  { key: 'referencias', re: /\b(referencias?|bibliograf[ií]a|fuentes|anexos?)\b/i }
];

const TITLE_WORDS = ['memoria', 'informe', 'trabajo', 'tesis', 'proyecto', 'estancia', 'informe de', 'memoria de'];

function analyzePresentation(text) {
  const issues = [];
  const lines = text.split('\n').map((l) => l.trim());
  const nonEmptyLines = lines.filter(Boolean);
  const lower = text.toLowerCase();

  if (text.trim().length < 100) {
    return { score: null, label: 'insufficient_data', issues: ['Documento demasiado corto para evaluar presentación'], details: {} };
  }

  // 1. Título
  const firstLines = nonEmptyLines.slice(0, 5).join(' ');
  const hasTitle = TITLE_WORDS.some((w) => lower.includes(w)) || /^[A-ZÁÉÍÓÚÑ]/.test(firstLines) && firstLines.length < 200;
  if (!hasTitle) {
    issues.push('No se detecta un título claro al inicio del documento');
  } else {
    // Verificar que el título no sea una frase completa larga
    const firstLine = nonEmptyLines[0] || '';
    if (firstLine.split(/\s+/).length > 20) {
      issues.push('La primera línea parece un párrafo, no un título: use una línea breve y en mayúsculas o negrita');
    }
  }

  // 2. Secciones esperadas en una memoria/informe académico
  const foundSections = SECTION_PATTERNS.filter((s) => s.re.test(text));
  const foundKeys = foundSections.map((s) => s.key);
  const expected = ['introduccion', 'metodologia', 'resultados'];
  const missing = expected.filter((k) => !foundKeys.includes(k));
  if (missing.length > 0) {
    issues.push(`Secciones no detectadas: ${missing.join(', ')} (se esperaban introducción, metodología y resultados/conclusiones)`);
  }

  // 3. Numeración de secciones (1., 1.1, Capítulo)
  const hasNumbering = /^\s*(\d+(\.\d+)*[.)]|cap[ií]tulo|secci[oó]n)\s/im.test(text);
  if (!hasNumbering && nonEmptyLines.length > 15) {
    issues.push('No se detecta numeración de secciones (1., 1.1, Capítulo...): estructura poco formal');
  }

  // 4. Párrafos de una sola línea / bloques rotos
  const singleLineParas = nonEmptyLines.filter((l) => l.length > 60 && l.split(/\s+/).length < 4 && !/^[-*•\d.]/.test(l));
  if (singleLineParas.length > nonEmptyLines.length * 0.3 && nonEmptyLines.length > 20) {
    issues.push('Muchas líneas sueltas que parecen párrafos rotos: revise la estructura de párrafos');
  }

  // 5. Extremos: documento con una sola "pared" de texto (sin saltos)
  if (nonEmptyLines.length < 8 && text.split(/\s+/).length > 400) {
    issues.push('El documento es un bloque de texto casi continuo: agregue párrafos y secciones');
  }

  // 6. Fecha / datos institucionales (señal débil, informativa)
  const hasDate = /\b(19|20)\d{2}\b/.test(text);
  const hasInstitution = /\b(universidad|instituto|facultad|escuela|hospital|clinica|laboratorio)\b/i.test(lower);
  if (!hasDate) issues.push('No se detecta año de elaboración (posible dato de portada faltante)');
  if (!hasInstitution) issues.push('No se detecta mención institucional (universidad, hospital, etc.)');

  // 7. Referencias bibliográficas formales (patrones DOI/APA-ish)
  const refPatterns = /(doi:|https?:\/\/|\(\d{4}\)|et al\.|\bvol\.?\s*\d+|\bpp?\.?\s*\d+)/i;
  if (!refPatterns.test(text)) {
    issues.push('No se detectan citas o referencias bibliográficas con formato reconocible');
  }

  // --- Puntuación (0-100) ---
  let score = 100;
  const weight = (cond) => { if (cond) score -= 12; };
  weight(!hasTitle);
  weight(missing.length >= 2);
  weight(missing.length === 1);
  weight(!hasNumbering && nonEmptyLines.length > 15);
  weight(singleLineParas.length > nonEmptyLines.length * 0.3);
  weight(nonEmptyLines.length < 8 && text.split(/\s+/).length > 400);
  weight(!hasDate);
  weight(!hasInstitution);
  weight(!refPatterns.test(text));
  if (foundKeys.includes('resumen')) score += 3;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    label: score >= 75 ? 'buena' : score >= 50 ? 'regular' : 'deficiente',
    issues,
    details: {
      lines: nonEmptyLines.length,
      sectionsFound: foundKeys,
      sectionsMissing: missing,
      hasTitle,
      hasNumbering,
      hasDate,
      hasInstitution,
      hasReferences: refPatterns.test(text)
    }
  };
}

module.exports = { analyzePresentation };
