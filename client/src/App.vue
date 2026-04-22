<template>
  <div class="app">
    <header class="app-header">
      <h1>Zubok <span class="subtitle">— generátor G-code pro box-joint</span></h1>
    </header>

    <main class="app-main" :class="{ 'has-result': !!result }">
      <!-- Levý sloupec: parametry -->
      <section class="panel panel-form">
        <div class="card">
          <div class="card-toolbar">
            <h2>Parametry</h2>
            <FileUpload @loaded="onYmlLoaded" />
          </div>

          <ParamsForm
            v-model="params"
            :loading="loading"
            @submit="generate"
          >
            <template #extra-actions>
              <template v-if="result">
                <button type="button" class="btn-secondary" @click="downloadA">
                  &#8595; {{ result.fn }}_a.nc
                </button>
                <button type="button" class="btn-secondary" @click="downloadB">
                  &#8595; {{ result.fn }}_b.nc
                </button>
              </template>
            </template>
          </ParamsForm>

          <div v-if="apiError" class="error-msg">
            Chyba: {{ apiError }}
          </div>
        </div>
      </section>

      <!-- Pravý sloupec: 3D viewer -->
      <section class="panel panel-viewer" :class="{ visible: !!result }">
        <CanvasView3D
          v-if="result"
          :paths-a="result.paths_a"
          :paths-b="result.paths_b"
          :meta="result.meta"
        />
        <div v-else class="viewer-placeholder">
          <span>Vyplňte parametry a klikněte na <strong>Generovat G-code</strong></span>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import axios from 'axios';
import ParamsForm    from './components/ParamsForm.vue';
import FileUpload    from './components/FileUpload.vue';
import CanvasView3D  from './components/CanvasView3D.vue';

const params   = ref(null);
const loading  = ref(false);
const apiError = ref('');
const result   = ref(null);

async function generate(formParams) {
  loading.value  = true;
  apiError.value = '';
  result.value   = null;
  try {
    const { data } = await axios.post('/api/generate', formParams);
    result.value = data;
  } catch (err) {
    apiError.value = err.response?.data?.error ?? err.message;
  } finally {
    loading.value = false;
  }
}

function downloadFile(content, filename) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadA() { result.value && downloadFile(result.value.gcode_a, `${result.value.fn}_a.nc`); }
function downloadB() { result.value && downloadFile(result.value.gcode_b, `${result.value.fn}_b.nc`); }

function onYmlLoaded(parsed) {
  params.value   = { ...parsed };
  result.value   = null;
  apiError.value = '';
}
</script>

<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --color-accent: #4a90e2;
  --color-border: #d0d0d0;
  --color-label:  #444;
  --color-bg:     #f4f6fb;
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 15px;
  color: #222;
  background: var(--color-bg);
}

body { min-height: 100vh; }
</style>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.app-header {
  background: #1e2b3c;
  color: #fff;
  padding: 0.75rem 1.5rem;
  flex-shrink: 0;
  z-index: 10;
}

.app-header h1 {
  font-size: 1.3rem;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.app-header .subtitle {
  font-size: 0.88rem;
  font-weight: 400;
  opacity: 0.6;
}

/* ─── Main layout ─── */
.app-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* Výchozí: jeden sloupec (před generováním) */
.panel-form {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  max-width: 680px;
  margin: 0 auto;
  transition: flex 0.3s, max-width 0.3s;
}

.panel-viewer {
  display: none;
  flex: 1;
  padding: 0.75rem;
  min-width: 0;
}

/* Po generování: split 50/50 */
.has-result .panel-form {
  flex: 0 0 340px;
  max-width: 340px;
  border-right: 1px solid #d0d8e8;
  margin: 0;
}

.has-result .panel-viewer {
  display: flex;
  flex-direction: column;
}

/* ─── Karta s formulářem ─── */
.card {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.card-toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: space-between;
}

.card-toolbar h2 {
  font-size: 1rem;
  font-weight: 700;
  color: #1e2b3c;
}

.error-msg {
  padding: 0.65rem 0.9rem;
  background: #fff0f0;
  border: 1px solid #f5c0c0;
  border-radius: 6px;
  color: #b00;
  font-size: 0.88rem;
}

.btn-secondary {
  padding: 0.45rem 0.85rem;
  background: #fff;
  color: var(--color-accent);
  border: 1.5px solid var(--color-accent);
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}

.btn-secondary:hover { background: #f0f7ff; }

/* ─── Placeholder před generováním ─── */
.viewer-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8899aa;
  font-size: 0.9rem;
  background: #1a1f2e;
  border-radius: 10px;
  text-align: center;
  padding: 2rem;
}

/* ─── Responsive: na úzkém displeji stack vertikálně ─── */
@media (max-width: 720px) {
  .app-main { flex-direction: column; }
  .has-result .panel-form {
    flex: 0 0 auto;
    max-width: 100%;
    border-right: none;
    border-bottom: 1px solid #d0d8e8;
  }
  .has-result .panel-viewer {
    flex: 1;
    min-height: 320px;
  }
}
</style>
