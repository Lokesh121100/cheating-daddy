import { describe, it, expect } from 'vitest';

describe('typescript + vitest tooling', () => {
    it('type-checks and runs a .ts test file', () => {
        expect(1 + 1).toBe(2);
    });
});
