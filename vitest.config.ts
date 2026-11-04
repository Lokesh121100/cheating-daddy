import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Some test files (e.g. tests/utils/gemini-ipc-validation.test.ts) rebuild and
        // then clean up compiled .js siblings of already-converted .ts modules around
        // their own run. Running test files in parallel would race that cleanup against
        // other files' dynamic imports of the same .ts sources, reintroducing the
        // compiled-output-shadowing bug fixed in the Phase 1 final review.
        fileParallelism: false,
    },
});
