import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  // Relativní cesty — build funguje i když nginx appku servíruje z podadresáře.
  // Aplikace nemá router, takže žádné hluboké URL se nelámou.
  base: './',
})
