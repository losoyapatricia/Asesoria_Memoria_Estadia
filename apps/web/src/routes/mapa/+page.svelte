<script>
  import UtcjMap from '$lib/components/UtcjMap.svelte';
</script>

<h1>Mapa del campus UTCJ</h1>
<p class="muted">
  Módulo independiente con <strong>Leaflet</strong>: muestra la traza perimetral
  del campus de la Universidad Tecnológica de Ciudad Juárez (Av. Universidad
  Tecnológica 3051, Col. Lote Bravo II, Cd. Juárez, Chih.).
</p>

<UtcjMap height="65vh" />

<div class="card" style="margin-top:1rem">
  <h3 style="margin-top:0">Acerca de la traza</h3>
  <p class="muted" style="font-size:0.9rem">
    El polígono corresponde al contorno del edificio/predio universitario según
    datos de OpenStreetMap (ODbL 1.0). Puede no reflejar con exactitud los
    límites catastrales oficiales.
  </p>
</div>
