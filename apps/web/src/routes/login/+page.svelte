<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { api } from '$lib/api';

  // ?tab=register abre directo en la pestaña de registro
  let tab = $state($page.url.searchParams.get('tab') === 'register' ? 'register' : 'login');

  // --- Login ---
  let email = $state('');
  let password = $state('');

  // --- Registro ---
  let fullName = $state('');
  let regEmail = $state('');
  let regPassword = $state('');
  let confirm = $state('');

  let error = $state('');
  let notice = $state('');
  let loading = $state(false);
  let showPassword = $state(false);

  function switchTab(t) {
    tab = t;
    error = '';
    notice = '';
  }

  function saveSession(data) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    goto('/dashboard');
  }

  async function submitLogin(e) {
    e.preventDefault();
    error = '';
    loading = true;
    try {
      saveSession(await api('/auth/login', { method: 'POST', body: { email, password } }));
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function submitRegister(e) {
    e.preventDefault();
    error = '';
    if (regPassword !== confirm) {
      error = 'Las contraseñas no coinciden';
      return;
    }
    loading = true;
    try {
      saveSession(await api('/auth/register', {
        method: 'POST',
        body: { email: regEmail, password: regPassword, fullName }
      }));
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }
</script>

<div class="auth-wrap">
  <div class="auth-card card">
    <div class="auth-brand">
      <span class="auth-logo">SI</span>
      <div>
        <h1>SISTEMAIA</h1>
        <p class="muted">Revisión de documentos académicos</p>
      </div>
    </div>

    <div class="tabs">
      <button class={tab === 'login' ? 'tab active' : 'tab'} onclick={() => switchTab('login')} type="button">
        Iniciar sesión
      </button>
      <button class={tab === 'register' ? 'tab active' : 'tab'} onclick={() => switchTab('register')} type="button">
        Crear cuenta
      </button>
    </div>

    {#if tab === 'login'}
      <form onsubmit={submitLogin} class="auth-form">
        <div>
          <label for="email">Correo electrónico</label>
          <input id="email" type="email" bind:value={email} required autocomplete="email" placeholder="tu@correo.com" />
        </div>
        <div>
          <label for="password">Contraseña</label>
          <div class="pwd-wrap">
            <input id="password" type={showPassword ? 'text' : 'password'} bind:value={password}
                   required autocomplete="current-password" placeholder="••••••••" />
            <button type="button" class="pwd-toggle" onclick={() => showPassword = !showPassword} tabindex="-1">
              {showPassword ? 'Ocultar' : 'Ver'}
            </button>
          </div>
        </div>
        {#if error}<p class="error">{error}</p>{/if}
        <button type="submit" disabled={loading} class="auth-submit">
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    {:else}
      <form onsubmit={submitRegister} class="auth-form">
        <div>
          <label for="name">Nombre completo</label>
          <input id="name" type="text" bind:value={fullName} autocomplete="name" placeholder="Nombre y apellidos" />
        </div>
        <div>
          <label for="reg-email">Correo electrónico</label>
          <input id="reg-email" type="email" bind:value={regEmail} required autocomplete="email" placeholder="tu@correo.com" />
        </div>
        <div>
          <label for="reg-password">Contraseña</label>
          <input id="reg-password" type="password" bind:value={regPassword} required minlength="8"
                 autocomplete="new-password" placeholder="Mínimo 8 caracteres" />
        </div>
        <div>
          <label for="confirm">Confirmar contraseña</label>
          <input id="confirm" type="password" bind:value={confirm} required autocomplete="new-password" placeholder="Repite la contraseña" />
        </div>
        <p class="muted auth-hint">El primer usuario registrado obtendrá rol de administrador.</p>
        {#if error}<p class="error">{error}</p>{/if}
        {#if notice}<p class="success">{notice}</p>{/if}
        <button type="submit" disabled={loading} class="auth-submit">
          {loading ? 'Creando cuenta…' : 'Registrarse'}
        </button>
      </form>
    {/if}
  </div>
</div>

<style>
  .auth-wrap {
    min-height: 80vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
  }
  .auth-card {
    width: 100%;
    max-width: 420px;
    padding: 2rem;
  }
  .auth-brand {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    margin-bottom: 1.5rem;
  }
  .auth-brand h1 { margin: 0; font-size: 1.3rem; color: var(--primary); }
  .auth-brand p { margin: 0.15rem 0 0; font-size: 0.85rem; }
  .auth-logo {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: linear-gradient(135deg, var(--primary), var(--primary-dark));
    color: #052e16;
    font-weight: 800;
    font-size: 1.2rem;
  }
  .tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.3rem;
    margin-bottom: 1.4rem;
  }
  .tab {
    background: transparent;
    color: var(--muted);
    padding: 0.55rem;
    border-radius: 8px;
  }
  .tab.active {
    background: var(--primary);
    color: #052e16;
  }
  .auth-form { display: grid; gap: 0.9rem; }
  .auth-form label { display: block; font-size: 0.85rem; margin-bottom: 0.3rem; color: var(--muted); }
  .pwd-wrap { position: relative; }
  .pwd-wrap input { padding-right: 4.5rem; }
  .pwd-toggle {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    color: var(--primary);
    font-size: 0.8rem;
    padding: 0.2rem 0.5rem;
  }
  .pwd-toggle:hover { background: transparent; color: #86efac; }
  .auth-submit { padding: 0.75rem; font-size: 1rem; }
  .auth-hint { font-size: 0.8rem; margin: 0; }
</style>
