const app = require('./app');
const config = require('./config/env');

app.listen(config.port, () => {
  console.log(`[api] SISTEMAIA backend escuchando en http://localhost:${config.port}`);
  console.log(`[api] Workers del analizador: ${config.analyzer.workers}`);
});
