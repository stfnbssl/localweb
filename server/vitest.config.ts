import { defineConfig } from 'vitest/config';

// I test coprono solo logica pura (costruzione della query string e parsing
// dell'output di Claude): nessuna rete, nessun filesystem, nessun mock. Restano
// fuori da `src/` perché `tsconfig.json` compila tutto `src/**` dentro `dist/`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
