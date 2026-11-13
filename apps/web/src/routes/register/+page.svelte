<script>
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => goto('/login?tab=register'));
</script>

<p class="muted">Redirigiendo al registro…</p>
