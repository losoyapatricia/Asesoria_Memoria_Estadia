<script>
  import { onMount } from 'svelte';
  import { UTCJ_BOUNDARY, UTCJ_CENTER } from '$lib/utcj';

  let { height = '480px' } = $props();

  let container;
  let map = null;
  let error = $state('');

  onMount(async () => {
    try {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      map = L.map(container, { scrollWheelZoom: true }).setView(UTCJ_CENTER, 16);

      // Teselas: OpenStreetMap estándar
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(map);

      // Traza del campus UTCJ
      const campus = L.geoJSON(UTCJ_BOUNDARY, {
        style: {
          color: '#0284c7',
          weight: 3,
          fillColor: '#38bdf8',
          fillOpacity: 0.25
        },
        onEachFeature: (feature, layer) => {
          layer.bindPopup(
            `<strong>${feature.properties.name}</strong><br/>${feature.properties.address}<br/>` +
            `<small>Traza perimetral · Fuente: OpenStreetMap (ODbL)</small>`
          );
        }
      }).addTo(map);

      // Marcador central
      L.marker(UTCJ_CENTER)
        .addTo(map)
        .bindPopup('<strong>UTCJ</strong><br/>Universidad Tecnológica de Ciudad Juárez')
        .openPopup();

      map.fitBounds(campus.getBounds().pad(0.15));
    } catch (e) {
      error = 'No se pudo cargar el mapa: ' + e.message;
    }
  });
</script>

<div class="map-wrap card" style="padding:0;overflow:hidden">
  {#if error}
    <p class="error" style="padding:1rem">{error}</p>
  {:else}
    <div bind:this={container} style="height:{height};width:100%"></div>
    <div class="map-attrib muted">
      Mapa: &copy; OpenStreetMap contributors · Traza del campus UTCJ según OpenStreetMap
    </div>
  {/if}
</div>

<style>
  .map-attrib {
    font-size: 0.75rem;
    padding: 0.4rem 0.8rem;
    border-top: 1px solid var(--border);
  }
</style>
