<template>
  <div class="file-upload">
    <label class="upload-label" :class="{ dragging }" @dragover.prevent="dragging = true" @dragleave="dragging = false" @drop.prevent="onDrop">
      <input type="file" accept=".yml,.yaml" @change="onFileChange" ref="fileInput" class="hidden-input" />
      <span class="upload-icon">📂</span>
      <span class="upload-text">
        <strong>Načíst .yml soubor</strong>
        <small>nebo přetáhněte sem</small>
      </span>
    </label>
    <span v-if="fileName" class="loaded-name">{{ fileName }}</span>
    <span v-if="error" class="upload-error">{{ error }}</span>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import yaml from 'js-yaml';

const emit = defineEmits(['loaded']);

const fileInput = ref(null);
const fileName  = ref('');
const error     = ref('');
const dragging  = ref(false);

function processFile(file) {
  if (!file) return;
  error.value = '';
  fileName.value = file.name;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = yaml.load(e.target.result, { schema: yaml.CORE_SCHEMA });
      if (typeof parsed !== 'object' || parsed === null) {
        error.value = 'Neplatný YAML soubor.';
        return;
      }
      emit('loaded', parsed);
    } catch (err) {
      error.value = `Chyba parsování YAML: ${err.message}`;
    }
  };
  reader.readAsText(file);
}

function onFileChange(e) {
  processFile(e.target.files[0]);
}

function onDrop(e) {
  dragging.value = false;
  processFile(e.dataTransfer.files[0]);
}
</script>

<style scoped>
.file-upload {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.upload-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 1rem;
  border: 1.5px dashed var(--color-border, #ccc);
  border-radius: 7px;
  cursor: pointer;
  background: #fafafa;
  transition: border-color 0.2s, background 0.2s;
  user-select: none;
}

.upload-label:hover,
.upload-label.dragging {
  border-color: var(--color-accent, #4a90e2);
  background: #f0f7ff;
}

.hidden-input {
  display: none;
}

.upload-icon {
  font-size: 1.1rem;
}

.upload-text {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
  font-size: 0.85rem;
}

.upload-text strong {
  color: #333;
}

.upload-text small {
  color: #888;
  font-size: 0.75rem;
}

.loaded-name {
  font-size: 0.82rem;
  color: #2a7a2a;
  background: #eafaea;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
}

.upload-error {
  font-size: 0.82rem;
  color: #b00;
  background: #fff0f0;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
}
</style>
