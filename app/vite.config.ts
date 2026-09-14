import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // The workspace .env lives beside the root package.json. Vite only exposes
  // VITE_* values to the browser, so loading this directory is safe while it
  // keeps app and server builds aligned. Tests use an isolated env directory
  // so a developer's local deployment values do not change unit expectations.
  envDir: mode === 'test' ? '.' : '..',
  server: { port: 5173, strictPort: true },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
}));
