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

export const httpLogger = pinoHttp<Request, Response>({
  logger,
  genReqId: (req) => {
    const headerId = req.headers['x-request-id'];
    if (typeof headerId === 'string' && headerId.length > 0) return headerId;
    return randomUUID();
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  autoLogging: {
    ignore: (req) => req.url === '/favicon.ico' || req.url === '/health',
  },
  customProps: (req) => ({
    ip: req.ip,
  }),
  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        url: req.url,
      };
    },
    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
});
