/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// GitHub Pages serves a project site from /<repo>/, so production assets need
// that base. Dev/test stay at root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/wz2100-tree/' : '/',
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
  },
}));
