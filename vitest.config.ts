import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom']
  },
  test: {
    // Reporte JUnit XML para publicar resultados de pruebas (UAT Report) en GitHub Actions.
    // Se activa con VITEST_JUNIT_FILE=reports/<archivo>.xml
    reporters: process.env.VITEST_JUNIT_FILE ? ['default', 'junit'] : ['default'],
    outputFile: process.env.VITEST_JUNIT_FILE
      ? { junit: process.env.VITEST_JUNIT_FILE }
      : undefined,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      include: [
        'packages/api/src/**/*.ts',
        'packages/frontend/src/**/*.{ts,tsx}'
      ],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/types.ts',
        'packages/api/src/index.ts',
        'packages/api/src/server.node.ts',
        'packages/frontend/src/main.tsx',
        'packages/frontend/src/vite-env.d.ts'
      ],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 75,
        statements: 75,
        'packages/api/src/domain/**': {
          lines: 85,
          functions: 85,
          branches: 85,
          statements: 85
        }
      }
    }
  }
});
