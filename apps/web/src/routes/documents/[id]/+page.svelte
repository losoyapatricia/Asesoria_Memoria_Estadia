<script>
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { api } from '$lib/api';

  let doc = $state(null);
  let analysis = $state(null);
  let loading = $state(true);
  let error = $state('');
  let analyzing = $state(false);

  const id = $page.params.id;

  let ai = $derived(analysis?.ai_probability);
  let ort = $derived(analysis?.orthography);
  let sty = $derived(analysis?.style);
  let pre = $derived(analysis?.presentation);

  async function load() {
    loading = true;
    try {
      const data = await api(`/documents/${id}`);
      doc = data.document;
      analysis = data.analysis;
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(load);

  async function runAnalysis() {
    analyzing = true;
    error = '';
    try {
      const data = await api(`/documents/${id}/analyze`, { method: 'POST' });
      analysis = data.analysis;
      await load();
    } catch (e) {
      error = e.message;
    } finally {
      analyzing = false;
    }
  }

  function scoreColor(score, invert = false) {
    if (score === null || score === undefined) return 'var(--muted)';
    const good = invert ? score <= 40 : score >= 75;
    const mid = invert ? score <= 65 : score >= 50;
    if (good) return 'var(--success)';
    if (mid) return 'var(--warning)';
    return 'var(--danger)';
  }

  function scoreLabel(score, invert = false) {
    if (score === null || score === undefined) return 'Sin datos';
    const good = invert ? score <= 40 : score >= 75;
    const mid = invert ? score <= 65 : score >= 50;
    if (good) return 'Bueno';
    if (mid) return 'Regular';
    return 'Deficiente';
  }
</script>

{#if loading}
  <p class="muted">Cargando informe…</p>
{:else if error && !doc}
  <div class="card"><p class="error">{error}</p></div>
{:else if doc}
  <p><a href="/dashboard">← Volver a documentos</a></p>
  <h1>{doc.title}</h1>
  <p class="muted">{doc.original_name} · subido el {new Date(doc.created_at).toLocaleString('es')}</p>

  {#if !analysis}
    <div class="card">
      <p>Este documento aún no tiene análisis.</p>
      {#if error}<p class="error">{error}</p>{/if}
      <button onclick={runAnalysis} disabled={analyzing}>
        {analyzing ? 'Analizando…' : 'Ejecutar análisis completo'}
      </button>
    </div>
  {:else}
    {#if error}<p class="error">{error}</p>{/if}

    <!-- Detección de IA -->
    <div class="card" style="margin-bottom:1rem">
      <h2 style="margin-top:0">¿Uso exclusivo de IA?</h2>
      {#if ai}
      <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
        <div style="font-size:2.4rem;font-weight:700;color:{scoreColor(ai.score, true)}">{ai.score}<span class="muted" style="font-size:1rem">/100</span></div>
        <div>
          <div><strong>{ai.labelText}</strong></div>
          <div class="muted">Confianza: {ai.confidence} · {ai.disclaimer}</div>
        </div>
      </div>
      {#if ai.issues?.length}
        <ul style="margin-top:0.8rem">
          {#each ai.issues as issue}<li>{issue}</li>{/each}
        </ul>
      {/if}
      {#if ai.metrics}
        <details style="margin-top:0.6rem">
          <summary class="muted">Métricas estilométricas</summary>
          <pre style="background:var(--bg);padding:0.8rem;border-radius:8px;overflow:auto;font-size:0.8rem">{JSON.stringify(ai.metrics, null, 2)}</pre>
        </details>
      {/if}
      {/if}
    </div>

    <!-- Puntuaciones -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem;margin-bottom:1rem">
      <div class="card">
        <h3 style="margin-top:0">Ortografía</h3>
        {#if ort}
        <div style="font-size:1.8rem;font-weight:700;color:{scoreColor(ort.score)}">{ort.score}<span class="muted" style="font-size:0.9rem">/100</span></div>
        <span class="badge {ort.score >= 80 ? 'ok' : ort.score >= 60 ? 'warn' : 'bad'}">{ort.label}</span>
        <p class="muted" style="font-size:0.85rem">{ort.totalErrors} observaciones</p>
        {/if}
      </div>

      <div class="card">
        <h3 style="margin-top:0">Redacción</h3>
        {#if sty.score === null}
          <p class="muted">Datos insuficientes</p>
        {:else}
          <div style="font-size:1.8rem;font-weight:700;color:{scoreColor(sty.score)}">{sty.score}<span class="muted" style="font-size:0.9rem">/100</span></div>
          <span class="badge {sty.score >= 75 ? 'ok' : sty.score >= 50 ? 'warn' : 'bad'}">{sty.label}</span>
        {/if}
      </div>

      <div class="card">
        <h3 style="margin-top:0">Presentación</h3>
        {#if pre.score === null}
          <p class="muted">Datos insuficientes</p>
        {:else}
          <div style="font-size:1.8rem;font-weight:700;color:{scoreColor(pre.score)}">{pre.score}<span class="muted" style="font-size:0.9rem">/100</span></div>
          <span class="badge {pre.score >= 75 ? 'ok' : pre.score >= 50 ? 'warn' : 'bad'}">{pre.label}</span>
        {/if}
      </div>
    </div>

    <!-- Detalles -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1rem">
      <div class="card">
        <h3 style="margin-top:0">Observaciones de redacción</h3>
        {#if analysis.style?.issues?.length}
          <ul>{#each analysis.style.issues as i}<li>{i}</li>{/each}</ul>
        {:else}<p class="muted">Sin observaciones relevantes.</p>{/if}
      </div>
      <div class="card">
        <h3 style="margin-top:0">Observaciones de presentación</h3>
        {#if analysis.presentation?.issues?.length}
          <ul>{#each analysis.presentation.issues as i}<li>{i}</li>{/each}</ul>
        {:else}<p class="muted">Sin observaciones relevantes.</p>{/if}
      </div>
      <div class="card">
        <h3 style="margin-top:0">Errores de ortografía ({analysis.orthography?.totalErrors ?? 0})</h3>
        {#if analysis.orthography?.errors?.length}
          <ul style="max-height:300px;overflow:auto">
            {#each analysis.orthography.errors.slice(0, 50) as err}
              <li><span class="badge {err.severity === 'alta' ? 'bad' : err.severity === 'media' ? 'warn' : 'info'}">{err.severity}</span> {err.message}</li>
            {/each}
          </ul>
          {#if analysis.orthography.totalErrors > 50}
            <p class="muted">…y {analysis.orthography.totalErrors - 50} más</p>
          {/if}
        {:else}<p class="muted">No se detectaron errores.</p>{/if}
      </div>
    </div>

    <p class="muted" style="margin-top:1rem;font-size:0.85rem">
      Analizado el {analysis.meta?.analyzedAt ? new Date(analysis.meta.analyzedAt).toLocaleString('es') : '—'} ·
      {analysis.meta?.wordCount} palabras · ortografía: {analysis.meta?.languageTool === 'enabled' ? 'LanguageTool + reglas' : 'reglas locales'}
    </p>
  {/if}
{/if}
