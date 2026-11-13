<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import { goto } from '$app/navigation';

  let documents = $state([]);
  let loading = $state(true);
  let uploading = $state(false);
  let analyzingId = $state(null);
  let error = $state('');
  let title = $state('');
  let fileInput = $state(null);
  let selectedFile = $state(null);

  const statusBadge = {
    uploaded: ['badge warn', 'Pendiente'],
    analyzing: ['badge info', 'Analizando…'],
    analyzed: ['badge ok', 'Analizado'],
    error: ['badge bad', 'Error']
  };

  async function load() {
    loading = true;
    try {
      const data = await api('/documents');
      documents = data.documents;
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(load);

  function onFileChange(e) {
    selectedFile = e.target.files?.[0] || null;
    if (!title && selectedFile) {
      title = selectedFile.name.replace(/\.[^.]+$/, '');
    }
  }

  async function upload(e) {
    e.preventDefault();
    if (!selectedFile) { error = 'Seleccione un archivo'; return; }
    uploading = true;
    error = '';
    try {
      const form = new FormData();
      form.append('file', selectedFile);
      if (title) form.append('title', title);
      await api('/documents', { method: 'POST', formData: form });
      selectedFile = null;
      title = '';
      if (fileInput) fileInput.value = '';
      await load();
    } catch (err) {
      error = err.message;
    } finally {
      uploading = false;
    }
  }

  async function analyze(doc) {
    analyzingId = doc.id;
    error = '';
    try {
      await api(`/documents/${doc.id}/analyze`, { method: 'POST' });
      await load();
      goto(`/documents/${doc.id}`);
    } catch (err) {
      error = err.message;
      analyzingId = null;
    }
  }

  async function remove(doc) {
    if (!confirm(`¿Eliminar "${doc.title}"?`)) return;
    try {
      await api(`/documents/${doc.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      error = err.message;
    }
  }

  function fmtDate(d) {
    return new Date(d).toLocaleString('es');
  }
</script>

<h1>Mis documentos</h1>
<p class="muted">Suba una Memoria de Estadías (o documento académico) en .txt, .md, .docx o .pdf para analizarla.</p>

<div class="card" style="margin-bottom:1.5rem">
  <form onsubmit={upload} style="display:grid;gap:0.9rem">
    <div style="display:grid;grid-template-columns:1fr 2fr auto;gap:0.9rem;align-items:end">
      <div>
        <label for="title">Título</label>
        <input id="title" bind:value={title} placeholder="Memoria de Estadías" />
      </div>
      <div>
        <label for="file">Archivo</label>
        <input id="file" type="file" bind:this={fileInput} onchange={onFileChange}
               accept=".txt,.md,.docx,.pdf" />
      </div>
      <button type="submit" disabled={uploading || !selectedFile}>
        {uploading ? 'Subiendo…' : 'Subir'}
      </button>
    </div>
    {#if error}<p class="error">{error}</p>{/if}
  </form>
</div>

{#if loading}
  <p class="muted">Cargando…</p>
{:else if documents.length === 0}
  <div class="card"><p class="muted">Aún no hay documentos. Suba el primero arriba.</p></div>
{:else}
  <div style="display:grid;gap:0.75rem">
    {#each documents as doc}
      {@const [badgeClass, badgeText] = statusBadge[doc.status] || ['badge', doc.status]}
      <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap">
        <div>
          <strong>{doc.title}</strong>
          <div class="muted" style="font-size:0.85rem">
            {doc.original_name} · {(doc.size_bytes / 1024).toFixed(0)} KB · {fmtDate(doc.created_at)}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:0.6rem">
          <span class="{badgeClass}">{badgeText}</span>
          {#if doc.status === 'analyzed'}
            <button class="secondary" onclick={() => goto(`/documents/${doc.id}`)}>Ver informe</button>
          {/if}
          {#if doc.status === 'uploaded' || doc.status === 'error'}
            <button onclick={() => analyze(doc)} disabled={analyzingId === doc.id}>
              {analyzingId === doc.id ? 'Analizando…' : 'Analizar'}
            </button>
          {/if}
          <button class="danger" onclick={() => remove(doc)}>Eliminar</button>
        </div>
      </div>
    {/each}
  </div>
{/if}
