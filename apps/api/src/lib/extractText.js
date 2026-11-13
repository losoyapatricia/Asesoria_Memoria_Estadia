const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');

const MAX_CHARS = 200_000;

/**
 * Extrae texto plano de un buffer según el mimetype/extensión.
 * Soporta: texto plano, .docx (mammoth) y .pdf (pdf-parse).
 */
async function extractText(buffer, mimetype, originalname = '') {
  const name = (originalname || '').toLowerCase();
  const mime = (mimetype || '').toLowerCase();

  if (mime.startsWith('text/') || /\.(txt|md|csv)$/.test(name)) {
    return buffer.toString('utf8').slice(0, MAX_CHARS);
  }

  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx')) {
    const { value } = await mammoth.extractRawText({ buffer });
    return (value || '').slice(0, MAX_CHARS);
  }

  if (mime === 'application/pdf' || name.endsWith('.pdf')) {
    const data = await pdfParse(buffer);
    return String(data.text || '').slice(0, MAX_CHARS);
  }

  const err = new Error('Formato no soportado. Use .txt, .md, .docx o .pdf');
  err.status = 415;
  throw err;
}

module.exports = { extractText };
