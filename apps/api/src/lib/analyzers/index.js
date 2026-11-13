const { detectAIProbability } = require('./aiDetector');
const { checkOrthography, checkWithLanguageTool, scoreOrthography, tokenizeWithPositions } = require('./spellcheck');
const { analyzeStyle } = require('./style');
const { analyzePresentation } = require('./presentation');
const config = require('../../config/env');

/**
 * Pipeline completo de análisis de un documento.
 * Se ejecuta dentro del balanceador de cargas (worker pool).
 */
async function analyzeDocument(text) {
  const wordCount = (text.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,}/g) || []).length;

  // Ortografía local (siempre) + LanguageTool opcional
  const local = checkOrthography(text);
  let errors = local.errors;
  let externalUsed = false;
  if (config.analyzer.languageToolUrl) {
    const ltErrors = await checkWithLanguageTool(text, config.analyzer.languageToolUrl);
    if (ltErrors && ltErrors.length) {
      errors = errors.concat(ltErrors);
      externalUsed = true;
    }
  }
  const orthography = scoreOrthography(errors, wordCount);

  const ai = detectAIProbability(text);
  const style = analyzeStyle(text);
  const presentation = analyzePresentation(text);

  return {
    aiProbability: ai,
    orthography,
    style,
    presentation,
    meta: {
      wordCount,
      charCount: text.length,
      languageTool: externalUsed ? 'enabled' : 'disabled',
      analyzedAt: new Date().toISOString()
    }
  };
}

module.exports = { analyzeDocument };
