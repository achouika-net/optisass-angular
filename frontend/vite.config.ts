import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    dedupe: [
      '@angular/animations',
      '@angular/cdk',
      '@angular/common',
      '@angular/compiler',
      '@angular/core',
      '@angular/forms',
      '@angular/material',
      '@angular/platform-browser',
      '@angular/router',
    ],
  },
  optimizeDeps: {
    include: [
      '@angular/animations',
      '@angular/cdk',
      '@angular/common',
      '@angular/compiler',
      '@angular/core',
      '@angular/forms',
      '@angular/material',
      '@angular/platform-browser',
      '@angular/router',
    ],
    force: false,
  },
});
