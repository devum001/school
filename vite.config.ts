import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  // Keep the browser origin aligned with the backend's local CORS/CSRF allowlist.
  server: { port: 5173, strictPort: true },
  build: { target: 'es2022' },
  plugins: [react(), tailwindcss()],
});
