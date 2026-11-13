require('dotenv').config({ path: require('path').resolve(__dirname, '../../../../.env') });
require('dotenv').config(); // fallback: .env dentro de apps/api

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Falta la variable de entorno requerida: ${key}. Revisa tu archivo .env`);
  }
}

module.exports = {
  port: process.env.PORT || 3001,
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  analyzer: {
    workers: parseInt(process.env.ANALYZER_WORKERS || '3', 10),
    queueLimit: parseInt(process.env.ANALYZER_QUEUE_LIMIT || '50', 10),
    taskTimeoutMs: parseInt(process.env.ANALYZER_TASK_TIMEOUT_MS || '120000', 10),
    languageToolUrl: process.env.LANGUAGE_TOOL_URL || null
  }
};
