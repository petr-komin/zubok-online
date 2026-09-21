/**
 * Konfigurace záložky "Proporce" — není to generátor G-code, ale počítadlo
 * rozměrů. Příznak `nastroj` říká App.vue, aby místo formuláře s 3D náhledem
 * vykreslil vlastní komponentu.
 */
export default {
  key:     'proporce',
  label:   'Proporce',
  popis:   'zlatý řez a příbuzné poměry',
  nastroj: true,
};
