/**
 * Redacción: evalúa claridad, extensión de frases, palabras rebuscadas
 * y muletillas típicas de textos generados por IA.
 */

// Muletillas / frases de relleno frecuentes en texto IA en español
const AI_FILLER_PHRASES = [
  'es importante destacar', 'cabe mencionar', 'cabe señalar', 'es fundamental',
  'en el mundo actual', 'en la actualidad', 'a lo largo de la historia',
  'no solo', 'no solamente', 'por un lado', 'por otro lado',
  'en primer lugar', 'en segundo lugar', 'por último', 'en conclusión',
  'como se mencionó anteriormente', 'como se ha mencionado',
  'vale la pena destacar', 'no cabe duda', 'sin lugar a dudas',
  'en resumen', 'dicho esto', 'con esto en mente', 'a continuación',
  'es crucial', 'es esencial', 'es imperativo', 'es vital',
  'además', 'furthermore', 'moreover', 'in conclusion'
];

// Gerundios de gerundio abusivo típico en traducciones/texto IA
const GERUND_ABUSE = /(\w+[aeiouáéíóú]ndo)\s+(?:el|la|los|las|un|una|este|esta|ese|esa|mi|tu|su|nuestro|nuestra)\b/gi;

function analyzeStyle(text) {
  const issues = [];
  const lower = ' ' + text.toLowerCase().replace(/\s+/g, ' ') + ' ';

  const words = (text.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,}/g) || []);
  const sentences = splitSentences(text);
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  if (words.length < 30) {
    return { score: null, label: 'insufficient_data', issues: ['Texto demasiado corto para evaluar redacción'], details: {} };
  }

  // 1. Longitudes de frase
  const sentLens = sentences.map((s) => s.split(/\s+/).length);
  const longSentences = sentLens.filter((l) => l > 35);
  const shortSentences = sentLens.filter((l) => l <= 5);
  const avg = sentLens.reduce((a, b) => a + b, 0) / sentLens.length;
  const pctLong = longSentences.length / sentences.length;
  const pctShort = shortSentences.length / sentences.length;

  if (pctLong > 0.25) {
    issues.push(`${(pctLong * 100).toFixed(0)}% de las frases superan las 35 palabras: tienden a ser difíciles de leer`);
  }
  if (pctShort > 0.4) {
    issues.push(`${(pctShort * 100).toFixed(0)}% de las frases son muy cortas: la redacción puede resultar entrecortada`);
  }

  // 2. Párrafos demasiado largos
  const longParagraphs = paragraphs.filter((p) => p.split(/\s+/).length > 250);
  if (longParagraphs.length > 0) {
    issues.push(`${longParagraphs.length} párrafo(s) superan las 250 palabras: conviene dividirlos para mejorar la legibilidad`);
  }

  // 3. Muletillas / fórmulas de relleno
  const fillerHits = [];
  for (const phrase of AI_FILLER_PHRASES) {
    const re = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'gi');
    const matches = text.match(re);
    if (matches) fillerHits.push({ phrase, count: matches.length });
  }
  const totalFillers = fillerHits.reduce((a, f) => a + f.count, 0);
  if (totalFillers > 0) {
    const top = fillerHits.sort((a, b) => b.count - a.count).slice(0, 5)
      .map((f) => `"${f.phrase}"×${f.count}`).join(', ');
    issues.push(`Fórmulas de relleno frecuentes: ${top}`);
  }

  // 4. Gerundio de gerundio abusivo
  const gerundMatches = text.match(GERUND_ABUSE);
  if (gerundMatches && gerundMatches.length > 3) {
    issues.push(`${gerundMatches.length} posibles casos de gerundio de gerundio (ej.: "${gerundMatches[0].trim()}")`);
  }

  // 5. Voz pasiva aproximada (ser/estar/fue + participio) — señal débil, solo informativa
  const passiveMatches = text.match(/\b(?:es|son|fue|fueron|será|serán|fue|siendo|estado|estados|estada|estadas)\s+\w+(?:ado|ido|ada|ida|to|ta|chos|chas|tos|tas)\b/gi) || [];
  const passiveRatio = passiveMatches.length / sentences.length;
  if (passiveRatio > 0.3) {
    issues.push(`Uso elevado de voz pasiva (~${(passiveRatio * 100).toFixed(0)}% de las frases): considere reformular en voz activa`);
  }

  // 6. Palabras muy largas (posible tecnicismo excesivo)
  const veryLong = words.filter((w) => w.length > 15).length;
  if (veryLong > words.length * 0.02) {
    issues.push(`${veryLong} palabras de más de 15 letras: posible exceso de tecnicismos o palabras rebuscadas`);
  }

  // --- Puntuación (0-100, mayor = mejor redacción) ---
  let score = 100;
  score -= Math.min(30, pctLong * 60);
  score -= Math.min(15, pctShort * 20);
  score -= Math.min(20, totalFillers * 3);
  score -= Math.min(10, longParagraphs.length * 4);
  score -= Math.min(10, Math.max(0, passiveRatio - 0.2) * 30);
  score -= Math.min(10, (veryLong / Math.max(words.length, 1)) * 200);
  score = Math.max(0, Math.round(score));

  return {
    score,
    label: score >= 75 ? 'buena' : score >= 50 ? 'regular' : 'deficiente',
    issues,
    details: {
      words: words.length,
      sentences: sentences.length,
      paragraphs: paragraphs.length,
      avgSentenceLength: +avg.toFixed(1),
      pctLongSentences: +(pctLong * 100).toFixed(1),
      pctShortSentences: +(pctShort * 100).toFixed(1),
      fillerCount: totalFillers,
      passiveEstimate: +passiveRatio.toFixed(2)
    }
  };
}

function splitSentences(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { analyzeStyle };
