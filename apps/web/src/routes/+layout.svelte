<script>
  import '../app.css';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';

  let { children } = $props();

  const publicRoutes = ['/login', '/register'];

  $effect(() => {
    // Leer localStorage directamente: el estado `token` puede quedar
    // desactualizado justo después del login (se escribe fuera de aquí).
    const currentToken = localStorage.getItem('token');
    const path = $page.url.pathname;
    if (!publicRoutes.includes(path) && !currentToken) {
      goto('/login');
    }
    if (publicRoutes.includes(path) && currentToken) {
      goto('/dashboard');
    }
  });

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    goto('/login');
  }
</script>

{#if !publicRoutes.includes($page.url.pathname)}
  <header class="topbar">
    <span class="brand">SISTEMAIA</span>
    <nav>
      <a href="/dashboard">Documentos</a>
      <a href="/mapa">Mapa UTCJ</a>
      <button class="secondary" onclick={logout}>Salir</button>
    </nav>
  </header>
{/if}

<main class="container">
  {@render children()}
</main>
