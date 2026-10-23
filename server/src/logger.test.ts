import { describe, expect, it } from 'vitest';
import { pathOnly, shortIp } from './logger.js';

describe('shortIp', () => {
  it('keeps the network of an address, not the device', () => {
    expect(shortIp('203.0.113.42')).toBe('203.0.113.0');
    expect(shortIp('::ffff:203.0.113.42')).toBe('203.0.113.0');
    expect(shortIp('2001:db8:85a3:8d3:1319:8a2e:370:7348')).toBe('2001:db8:85a3::');
    expect(shortIp('2001:db8::1')).toBe('2001:db8:0::');
    expect(shortIp('::1')).toBe('0:0:0::');
    expect(shortIp(undefined)).toBeUndefined();
    expect(shortIp('unknown')).toBe('unknown');
  });
});

describe('pathOnly', () => {
  it('drops the query, where the OAuth code and state would be', () => {
    expect(pathOnly('/api/auth/callback?code=secret&state=abc')).toBe('/api/auth/callback');
    expect(pathOnly('/wp-admin')).toBe('/wp-admin');
    expect(pathOnly(undefined)).toBeUndefined();
  });
});
