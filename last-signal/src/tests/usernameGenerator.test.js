import { describe, expect, it } from 'vitest'
import { generateUsername } from '../lib/usernameGenerator'

const adjectives = [
    'silent', 'midnight', 'lost', 'quiet', 'hidden', 'fading', 'distant',
    'wandering', 'soft', 'echoing', 'drifting', 'hollow', 'phantom', 'ghostly',
    'broken', 'frozen', 'burning', 'falling', 'endless', 'fleeting', 'shadowed',
    'neon', 'lunar', 'solar', 'astral', 'spectral', 'velvet', 'crimson', 'amber',
    'obsidian', 'silver', 'pale', 'dim', 'deep', 'lone', 'void', 'stark', 'hazy',
    'muted', 'blurred', 'waning', 'sunken', 'rusted', 'ashen', 'orbital',
    'nocturnal', 'transient', 'forgotten', 'fractured', 'unnamed',
]

const nouns = [
    'signal', 'orbit', 'frequency', 'wave', 'echo', 'pulse', 'shadow', 'comet',
    'horizon', 'static', 'aurora', 'void', 'drift', 'ember', 'flare', 'nebula',
    'whisper', 'cipher', 'rift', 'glimmer', 'phantom', 'current', 'frost', 'moth',
    'tide', 'shard', 'vertex', 'remnant', 'satellite', 'haze', 'specter', 'glow',
    'binary', 'nova', 'wraith', 'monolith', 'solstice', 'meridian', 'vortex',
    'tempest', 'twilight', 'fragment', 'beacon', 'vessel', 'mirage', 'reverie',
    'voltage', 'threshold', 'cosmos', 'parallax',
]

describe('generateUsername', () => {
    it('returns a string', () => {
        expect(typeof generateUsername()).toBe('string')
    })

    it('follows the adjective_noun format', () => {
        const name = generateUsername()
        expect(name).toMatch(/^[a-z]+_[a-z]+$/)
    })

    it('uses an underscore as the separator', () => {
        const name = generateUsername()
        expect(name).toContain('_')
    })

    it('produces exactly two parts separated by one underscore', () => {
        const name = generateUsername()
        const parts = name.split('_')
        expect(parts.length).toBe(2)
    })

    it('uses a valid adjective as the first part', () => {
        const name = generateUsername()
        const [adj] = name.split('_')
        expect(adjectives).toContain(adj)
    })

    it('uses a valid noun as the second part', () => {
        const name = generateUsername()
        const [, noun] = name.split('_')
        expect(nouns).toContain(noun)
    })

    it('generates different names on consecutive calls (non-deterministic)', () => {
        const names = new Set(Array.from({ length: 50 }, () => generateUsername()))
        // With 50 adjectives × 50 nouns = 2500 combos, expect variety
        expect(names.size).toBeGreaterThan(5)
    })

    it('never returns an empty string', () => {
        for (let i = 0; i < 20; i++) {
            expect(generateUsername().length).toBeGreaterThan(0)
        }
    })
})
