<template>
  <form class="params-form" @submit.prevent="$emit('submit', localParams)">
    <div class="form-grid">
      <div class="field" :class="{ 'full-width': field.fullWidth }" v-for="field in fields" :key="field.key">
        <label :for="field.key">{{ field.label }}</label>
        <div class="input-wrap">
          <input
            :id="field.key"
            v-model="localParams[field.key]"
            :type="field.type ?? 'number'"
            :step="field.step ?? 'any'"
            :min="field.min ?? 0"
            :max="field.max"
            :placeholder="field.placeholder"
            required
            @input="onInput(field.key)"
          />
          <span v-if="field.unit" class="unit">{{ field.unit }}</span>
        </div>
        <small v-if="field.hint" class="hint">{{ field.hint }}</small>
      </div>
    </div>

    <div class="form-info" v-if="info.length">
      <span v-for="row in info" :key="row.label">
        {{ row.label }}: <strong>{{ row.value }}</strong>
      </span>
    </div>

    <div class="form-actions">
      <slot name="extra-actions" />
      <button type="submit" :disabled="loading" class="btn-primary">
        <span v-if="loading">Generuji&hellip;</span>
        <span v-else>Generovat G-code</span>
      </button>
    </div>
  </form>
</template>

<script setup>
import { reactive, computed, watch } from 'vue';

const props = defineProps({
  /** Definice polí — viz src/generators/* */
  fields:     { type: Array,  required: true },
  /** Výchozí hodnoty, pokud nepřijdou zvenku */
  defaults:   { type: Object, default: () => ({}) },
  /** Funkce vracející dopočítané hodnoty [{label, value}] */
  info:       { type: Function, default: null },
  modelValue: { type: Object, default: null },
  loading:    { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'submit']);

const localParams = reactive({ ...props.defaults, ...(props.modelValue ?? {}) });

// Pole, která uživatel ručně přepsal — ta už nepřepočítáváme automaticky
const rucne = reactive({});

/**
 * Dopočítá pole s `auto()`, kterých se uživatel zatím nedotkl.
 * @param {boolean} jenPrazdna  při startu vyplnit jen chybějící hodnoty
 */
function dopocitej(jenPrazdna = false) {
  for (const f of props.fields) {
    if (!f.auto || rucne[f.key]) continue;
    const soucasna = localParams[f.key];
    if (jenPrazdna && soucasna !== undefined && soucasna !== null && soucasna !== '') continue;
    const nova = f.auto(localParams);
    if (nova === undefined || nova === null) continue;
    if (String(nova) !== String(soucasna)) localParams[f.key] = nova;
  }
}

dopocitej(true);

function onInput(key) {
  rucne[key] = true;
  dopocitej();
}

// Synchronizace při vnějším update (z YML importu)
watch(() => props.modelValue, (val) => {
  if (val) Object.assign(localParams, val);
});

// Emit při každé změně
watch(localParams, (val) => emit('update:modelValue', { ...val }));

const info = computed(() => props.info?.(localParams) ?? []);
</script>

<style scoped>
.params-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem 0.75rem;
}

.field.full-width {
  grid-column: 1 / -1;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-label, #555);
}

.input-wrap {
  display: flex;
  align-items: center;
  border: 1px solid var(--color-border, #ccc);
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
  transition: border-color 0.2s;
}

.input-wrap:focus-within {
  border-color: var(--color-accent, #4a90e2);
  box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.15);
}

input {
  flex: 1;
  border: none;
  outline: none;
  padding: 0.4rem 0.5rem;
  font-size: 0.9rem;
  background: transparent;
  min-width: 0;
  width: 0;
}

.unit {
  padding: 0 0.6rem;
  font-size: 0.8rem;
  color: #888;
  background: #f5f5f5;
  border-left: 1px solid #ddd;
  white-space: nowrap;
  align-self: stretch;
  display: flex;
  align-items: center;
}

.hint {
  font-size: 0.7rem;
  color: #aaa;
}

.form-info {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1.25rem;
  font-size: 0.9rem;
  color: #444;
  padding: 0.5rem 0.8rem;
  background: #f0f7ff;
  border-radius: 6px;
  border: 1px solid #c8e0ff;
}

.form-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

.btn-primary {
  padding: 0.6rem 1.4rem;
  background: var(--color-accent, #4a90e2);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, opacity 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #357abd;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
