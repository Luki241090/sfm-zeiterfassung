import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0', // Erreichbar im WLAN
    port: 5173      // Standard Vite Port
  }
});
