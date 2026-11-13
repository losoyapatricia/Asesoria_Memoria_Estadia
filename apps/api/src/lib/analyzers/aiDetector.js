/**
 * Detector heurístico de texto generado por IA (estimación, NO es concluyente).
 *
 * Se basa en métricas estilométricas clásicas:
 *  - Diversidad léxica (type-token ratio y hapax)
 *  - Uniformidad de longitud de frases y párrafos (la IA tiende a regularidad)
 *  - Riqueza de puntuación y conectores
 *  - Repetición de n-gramas
 *
 * Devuelve una puntuación 0-100 donde MAYOR = más probable que sea IA.
 */
function detectAIProbability(text) {
  const issues = [];
  const words = tokenizeWords(text);
  const sentences = splitSentences(text);
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  if (words.length < 50 || sentences.length < 3) {
    return { score: 0, label: 'insufficient_data', confidence: 'baja', issues: ['Documento demasiado corto para un análisis fiable'] };
  }

  // 1. Diversidad léxica
  const unique = new Set(words.map((w) => w.toLowerCase()));
  const ttr = unique.size / words.length;
  const freq = {};
  for (const w of words) {
    const lw = w.toLowerCase();
    freq[lw] = (freq[lw] || 0) + 1;
  }
  const hapax = Object.values(freq).filter((c) => c === 1).length / unique.size;

  // 2. Uniformidad de frases (coeficiente de variación de longitud)
  const sentLens = sentences.map((s) => s.split(/\s+/).length);
  const cvSentences = coefficientOfVariation(sentLens);

  // 3. Uniformidad de párrafos
  const paraLens = paragraphs.map((p) => p.split(/\s+/).length);
  const cvParagraphs = coefficientOfVariation(paraLens);

  // 4. Longitud media de frase
  const avgSentence = sentLens.reduce((a, b) => a + b, 0) / sentLens.length;

  // 5. Riqueza de puntuación
  const punctCount = (text.match(/[,.!?;:()¿?¡«»"']/g) || []).length;
  const punctRatio = punctCount / words.length;

  // 6. Repetición de bigramas de palabras funcionales comunes
  const functionWords = new Set(['de', 'la', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para', 'con', 'no', 'una', 'su', 'al', 'es', 'lo', 'como', 'más', 'pero', 'sus', 'le', 'ya', 'o', 'este', 'sí', 'porque', 'esta', 'entre', 'cuando', 'muy', 'sin', 'sobre', 'también', 'me', 'hasta', 'hay', 'donde', 'quien', 'desde', 'todo', 'nos', 'durante', 'todos', 'uno', 'les', 'ni', 'contra', 'otros', 'ese', 'eso', 'ante', 'ellos', 'e', 'esto', 'mí', 'antes', 'algunos', 'qué', 'unos', 'yo', 'otro', 'otras', 'otra', 'él', 'tanto', 'esa', 'estos', 'mucho', 'quienes', 'nada', 'muchos', 'cual', 'poco', 'ella', 'estar', 'estas', 'algunas', 'algo', 'nosotros']);
  const bigrams = {};
  const lower = words.map((w) => w.toLowerCase());
  for (let i = 0; i < lower.length - 1; i++) {
    if (functionWords.has(lower[i]) && functionWords.has(lower[i + 1])) {
      const bg = lower[i] + ' ' + lower[i + 1];
      bigrams[bg] = (bigrams[bg] || 0) + 1;
    }
  }
  const topBigram = Math.max(0, ...Object.values(bigrams));
  const bigramDominance = topBigram / sentences.length;

  // --- Puntuación heurística (0-100) ---
  let score = 50;

  // Baja diversidad léxica → más IA
  if (ttr < 0.35) { score += 15; issues.push(`Diversidad léxica baja (TTR=${ttr.toFixed(2)}): vocabulario repetitivo, típico de texto generado`); }
  else if (ttr > 0.55) { score -= 10; issues.push(`Diversidad léxica alta (TTR=${ttr.toFixed(2)}): léxico variado`); }

  if (hapax < 0.4) { score += 8; issues.push(`Pocas palabras únicas (hapax=${(hapax * 100).toFixed(0)}%)`); }

  // Uniformidad excesiva → más IA
  if (cvSentences !== null && cvSentences < 0.35) { score += 15; issues.push(`Longitud de frases muy uniforme (CV=${cvSentences.toFixed(2)}): la prosa humana suele ser más irregular`); }
  if (cvParagraphs !== null && cvParagraphs < 0.3 && paragraphs.length > 2) { score += 8; issues.push(`Párrafos de longitud casi idéntica (CV=${cvParagraphs.toFixed(2)})`); }

  // Frases demasiado "perfectas" en extensión media
  if (avgSentence >= 18 && avgSentence <= 28 && cvSentences !== null && cvSentences < 0.45) {
    score += 8;
    issues.push(`Longitud media de frase en rango típico de modelos (${avgSentence.toFixed(1)} palabras)`);
  }

  // Conectores repetitivos dominantes
  if (bigramDominance > 0.5) { score += 7; issues.push(`Conectores funcionales muy repetitivos ("${topBigramArg(bigrams)}" domina)`); }

  // Puntuación escasa o excesivamente regular → leve señal
  if (punctRatio < 0.02) { score += 5; issues.push('Puntuación escasa en relación al texto'); }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let label;
  if (score >= 70) label = 'probable_ia';
  else if (score >= 45) label = 'incierto';
  else label = 'probable_humano';

  return {
    score,
    label,
    labelText: {
      probable_ia: 'Probable texto generado por IA',
      incierto: 'No concluyente (texto ambiguo)',
      probable_humano: 'Probablemente redacción humana'
    }[label],
    confidence: words.length > 300 ? 'media' : 'baja',
    disclaimer: 'Estimación heurística: no constituye una prueba concluyente de autoría.',
    metrics: {
      words: words.length,
      sentences: sentences.length,
      paragraphs: paragraphs.length,
      typeTokenRatio: +ttr.toFixed(3),
      hapaxRatio: +hapax.toFixed(3),
      sentenceLengthCV: cvSentences === null ? null : +cvSentences.toFixed(3),
      paragraphLengthCV: cvParagraphs === null ? null : +cvParagraphs.toFixed(3),
      avgSentenceLength: +avgSentence.toFixed(1),
      punctuationRatio: +punctRatio.toFixed(3)
    },
    issues
  };
}

function tokenizeWords(text) {
  return (text.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,}/g) || []);
}

function splitSentences(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 3);
}

function coefficientOfVariation(values) {
  if (!values.length) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

function topBigramArg(bigrams) {
  let top = null;
  let max = -1;
  for (const [k, v] of Object.entries(bigrams)) {
    if (v > max) { max = v; top = k; }
  }
  return top || '';
}

module.exports = { detectAIProbability };
