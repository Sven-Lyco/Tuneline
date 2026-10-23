import pino from 'pino';
import pinoHttp from 'pino-http';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

const IS_PROD = process.env.NODE_ENV === 'production';
const LEVEL = process.env.LOG_LEVEL ?? (IS_PROD ? 'info' : 'debug');

export const logger = pino(
  // Pretty-printing runs in a worker thread; skip it when nothing is logged (tests).
  IS_PROD || LEVEL === 'silent'
    ? {
        level: LEVEL,
        // No pid and hostname on every line: the machine's name isn't the log's business.
        base: undefined,
        formatters: {
          level: (label) => ({ level: label.toUpperCase() }),
        },
      }
    : {
        level: LEVEL,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      }
);

/** IPv6 address as its eight groups ("2001:db8::1" → 2001, db8, 0 … 0, 1). */
function ipv6Groups(ip: string): string[] {
  const [head, tail] = ip.split('::');
  const before = head ? head.split(':') : [];
  if (tail === undefined) return before;
  const after = tail ? tail.split(':') : [];
  return [...before, ...Array(Math.max(0, 8 - before.length - after.length)).fill('0'), ...after];
}

/**
 * An IP as the logs keep it: the network stays recognisable (scanners, abuse), the person behind
 * it doesn't. IPv4 loses its last block, IPv6 keeps its first three (the /48). The limits in
 * limits.ts still work with the full address; only logs get this one.
 */
export function shortIp(ip: string | undefined): string | undefined {
  if (!ip) return ip;
  const v4 = ip.replace(/^::ffff:/i, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v4)) return v4.replace(/\.\d+$/, '.0');
  if (ip.includes(':')) return `${ipv6Groups(ip).slice(0, 3).join(':')}::`;
  return ip;
}

/** The path only: query strings can hold secrets (the OAuth code and state on /api/auth/callback). */
export function pathOnly(url: string | undefined): string | undefined {
  return url?.split('?')[0];
}

export const httpLogger = pinoHttp<Request, Response>({
  logger,
  genReqId: (req) => {
    const headerId = req.headers['x-request-id'];
    if (typeof headerId === 'string' && headerId.length > 0) return headerId;
    return randomUUID();
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    // 404s are mostly internet scanners probing for /.env, /wp-admin …: noise, not a warning.
    if (res.statusCode >= 400 && res.statusCode !== 404) return 'warn';
    return 'info';
  },
  autoLogging: {
    ignore: (req) => req.url === '/favicon.ico' || req.url === '/health',
  },
  customProps: (req) => ({
    ip: shortIp(req.ip),
  }),
  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        url: pathOnly(req.url),
      };
    },
    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
});
