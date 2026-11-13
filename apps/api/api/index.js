// Entrada serverless para Vercel: envuelve la app Express.
// vercel.json reescribe todas las rutas hacia este archivo.
const serverless = require('serverless-http');
const app = require('../src/app');

module.exports = serverless(app);
