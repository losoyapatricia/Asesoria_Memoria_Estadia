/**
 * Balanceador de cargas para tareas CPU-bound (análisis de documentos).
 *
 * Mantiene un pool de `workers` slots concurrentes. Cada tarea se asigna al
 * worker con menos carga activa (least-busy). Las tareas en espera forman una
 * cola acotada. Expone métricas para observabilidad.
 */
class LoadBalancer {
  constructor({ workers = 3, queueLimit = 50, taskTimeoutMs = 120000, name = 'analyzer' } = {}) {
    this.name = name;
    this.workers = Array.from({ length: workers }, (_, i) => ({
      id: `${name}-w${i}`,
      active: 0,
      total: 0,
      errors: 0
    }));
    this.queueLimit = queueLimit;
    this.taskTimeoutMs = taskTimeoutMs;
    this.queue = [];
    this.metrics = { submitted: 0, completed: 0, failed: 0, totalLatencyMs: 0 };
    this._pumpScheduled = false;
  }

  get stats() {
    return {
      name: this.name,
      workers: this.workers.map((w) => ({ ...w })),
      queueLength: this.queue.length,
      queueLimit: this.queueLimit,
      metrics: { ...this.metrics }
    };
  }

  /**
   * Ejecuta `task` (función async) balanceando entre workers.
   * @param {Function} task  async () => result
   */
  run(task) {
    if (this.queue.length >= this.queueLimit && this._busyCount() >= this.workers.length) {
      return Promise.reject(Object.assign(new Error('Cola del analizador saturada, reintenta más tarde'), { status: 503 }));
    }
    this.metrics.submitted += 1;
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject, enqueuedAt: Date.now() });
      this._schedulePump();
    });
  }

  _busyCount() {
    return this.workers.reduce((acc, w) => acc + w.active, 0);
  }

  _schedulePump() {
    if (this._pumpScheduled) return;
    this._pumpScheduled = true;
    setImmediate(() => {
      this._pumpScheduled = false;
      this._pump();
    });
  }

  _pump() {
    while (this.queue.length > 0) {
      const worker = this.workers.reduce((best, w) => (w.active < best.active ? w : best), this.workers[0]);
      if (worker.active >= 1) break; // cada worker ejecuta 1 tarea a la vez
      const job = this.queue.shift();
      worker.active += 1;
      worker.total += 1;
      const startedAt = Date.now();

      const timeout = setTimeout(() => {
        job.reject(Object.assign(new Error('La tarea de análisis excedió el tiempo límite'), { status: 504 }));
      }, this.taskTimeoutMs);

      Promise.resolve()
        .then(job.task)
        .then((result) => {
          clearTimeout(timeout);
          const latency = Date.now() - startedAt;
          this.metrics.completed += 1;
          this.metrics.totalLatencyMs += latency;
          job.resolve(result);
        })
        .catch((err) => {
          clearTimeout(timeout);
          worker.errors += 1;
          this.metrics.failed += 1;
          job.reject(err);
        })
        .finally(() => {
          worker.active -= 1;
          this._schedulePump();
        });
    }
  }
}

module.exports = { LoadBalancer };
