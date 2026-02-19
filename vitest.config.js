import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['./game/**/*.test.js'],
        globals: true,
    },
});
