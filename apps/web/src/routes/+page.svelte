<script>
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    const token = localStorage.getItem('token');
    goto(token ? '/dashboard' : '/login');
  });
</script>

<p class="muted">Cargando…</p>
