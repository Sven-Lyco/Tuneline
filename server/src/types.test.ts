import { describe, expect, it } from 'vitest';
import { clampRounds, isValidAudioMode, sameName, toTurnLimit } from './types.js';
import { generateCode, shuffle } from './utils.js';

describe('setting helpers', () => {
  it('clamps rounds to 1–20 and defaults garbage to 5', () => {
    expect(clampRounds(10)).toBe(10);
    expect(clampRounds(0)).toBe(1);
    expect(clampRounds(99)).toBe(20);
    expect(clampRounds(7.6)).toBe(8);
    expect(clampRounds('10')).toBe(5);
    expect(clampRounds(Number.NaN)).toBe(5);
  });

  it('only accepts the offered turn limits', () => {
    expect(toTurnLimit(60)).toBe(60);
    expect(toTurnLimit(0)).toBe(0);
    expect(toTurnLimit(45)).toBe(0);
    expect(toTurnLimit('30')).toBe(0);
  });

  it('validates audio modes', () => {
    expect(isValidAudioMode('all')).toBe(true);
    expect(isValidAudioMode('host-only')).toBe(true);
    expect(isValidAudioMode('loud')).toBe(false);
  });

  it('compares names ignoring case and surrounding spaces', () => {
    expect(sameName(' Anna ', 'anna')).toBe(true);
    expect(sameName('Jürgen', 'JÜRGEN')).toBe(true);
    expect(sameName('Anna', 'Anne')).toBe(false);
  });
});

describe('utils', () => {
  it('generates codes of the requested length from the given alphabet', () => {
    const code = generateCode(48, 'ab');
    expect(code).toMatch(/^[ab]{48}$/);
  });

  it('shuffles in place and keeps every element', () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const result = shuffle(items);
    expect(result).toBe(items);
    expect([...result].sort((a, b) => a - b)).toEqual(Array.from({ length: 50 }, (_, i) => i));
  });
});
