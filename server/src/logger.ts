import pino from 'pino';

const IS_PROD = process.env.NODE_ENV === 'production';

export const logger = pino(
  IS_PROD
    ? { level: 'DEBUG' }
    : {
        level: 'DEBUG',
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
