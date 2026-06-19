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
          />
          <span v-if="field.unit" class="unit">{{ field.unit }}</span>
        </div>
        <small v-if="field.hint" class="hint">{{ field.hint }}</small>
      </div>
    </div>

    <div class="form-info" v-if="sirkaZubku !== null">
      <span>Šířka zubku: <strong>{{ sirkaZubku.toFixed(3) }} mm</strong></span>
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
  modelValue: { type: Object, default: null },
  loading:    { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'submit']);

const defaults = {
  nazev:          'jasanova krabicka',
  tloustka_prkna: 12,
  sirka_prkna:    28,
  pocet_zubu:     6,
  hloubka_zubu:   5,
  freza:          4,
  krok_vnoreni:   1,
  drveni:         0,
};

const localParams = reactive({ ...(props.modelValue ?? defaults) });

// Synchronizace při vnějším update (z YML importu)
watch(() => props.modelValue, (val) => {
  if (val) Object.assign(localParams, val);
});

// Emit při každé změně
watch(localParams, (val) => emit('update:modelValue', { ...val }));

const sirkaZubku = computed(() => {
  const s = parseFloat(localParams.sirka_prkna);
  const p = parseFloat(localParams.pocet_zubu);
  if (!s || !p || p === 0) return null;
  return s / p;
});

const fields = [
  {
    key: 'nazev',
    label: 'Název',
    type: 'text',
    step: undefined,
    min: undefined,
    placeholder: 'jasanova krabicka',
    hint: 'Použije se jako název souboru',
    fullWidth: true,
  },
  {
    key: 'tloustka_prkna',
    label: 'Tloušťka prkna',
    unit: 'mm',
    step: 0.1,
    placeholder: '12',
    hint: 'Tloušťka frézovaného materiálu',
  },
  {
    key: 'sirka_prkna',
    label: 'Šířka prkna',
    unit: 'mm',
    step: 0.1,
    placeholder: '28',
    hint: 'Celková šířka, z níž se počítá počet zubů',
  },
  {
    key: 'pocet_zubu',
    label: 'Počet zubů',
    step: 1,
    min: 1,
    placeholder: '6',
    hint: 'Musí být celé číslo',
  },
  {
    key: 'hloubka_zubu',
    label: 'Hloubka zubu',
    unit: 'mm',
    step: 0.1,
    placeholder: '5',
    hint: 'Jak hluboko frézuje zub',
  },
  {
    key: 'freza',
    label: 'Průměr frézy',
    unit: 'mm',
    step: 0.1,
    placeholder: '4',
    hint: 'Průměr stopkové frézy',
  },
  {
    key: 'krok_vnoreni',
    label: 'Krok vnoření',
    unit: 'mm',
    step: 0.1,
    placeholder: '2',
    hint: 'Hloubka záběru na jeden průjezd',
  },
  {
    key: 'drveni',
    label: 'Drvení',
    unit: 'mm',
    step: 0.01,
    min: -1,
    max: 1,
    placeholder: '0',
    hint: 'Kladná hodnota = drážka užší (těsnější spoj), záporná = drážka širší (volnější spoj)',
  },
];
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
