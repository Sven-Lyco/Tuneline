import { config } from 'dotenv';
if (process.env.NODE_ENV !== 'production') {
  config({ path: '.env.local' });
}

import { createTunelineServer } from './app.js';
import { logger } from './logger.js';

const PORT = Number(process.env.PORT ?? 3001);
const IS_PROD = process.env.NODE_ENV === 'production';

const { httpServer, io } = createTunelineServer({
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://[::1]:5174',
  isProd: IS_PROD,
  operator: {
    operatorName: process.env.OPERATOR_NAME?.trim() || null,
    operatorContact: process.env.OPERATOR_CONTACT?.trim() || null,
  },
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandled_rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaught_exception');
  process.exit(1);
});

// Rooms live in memory only, so a restart (e.g. a deploy) ends every game. At least tell players.
process.on('SIGTERM', () => {
  logger.info('sigterm_shutdown');
  io.emit('server_restarting');
  setTimeout(() => process.exit(0), 500);
});

httpServer.listen(PORT, () => {
  logger.info({ port: PORT, env: IS_PROD ? 'production' : 'development' }, 'server_start');
});
