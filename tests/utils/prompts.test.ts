import { describe, it, expect } from 'vitest';
import { getSystemPrompt, profilePrompts } from '../../src/utils/prompts';

describe('getSystemPrompt', () => {
    it('includes the intro and output instructions for a known profile', () => {
        const result = getSystemPrompt('interview');
        expect(result).toContain(profilePrompts.interview.intro);
        expect(result).toContain(profilePrompts.interview.outputInstructions);
    });

    it('falls back to the interview profile for an unknown profile key', () => {
        expect(getSystemPrompt('not-a-real-profile')).toBe(getSystemPrompt('interview'));
    });

    it('omits the search usage section when googleSearchEnabled is false', () => {
        const result = getSystemPrompt('interview', '', false);
        expect(result).not.toContain(profilePrompts.interview.searchUsage);
    });

    it('embeds the custom prompt between the context markers', () => {
        const result = getSystemPrompt('interview', 'my custom context', true);
        expect(result).toContain('User-provided context\n-----\nmy custom context\n-----');
    });
});
