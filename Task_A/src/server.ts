import app from './app';
import { config } from './config';
import { logger } from './utils/logger';

app.listen(config.port, () => {
  logger.info(`PagePulse Audit Service running on port ${config.port} [Environment: ${config.nodeEnv}]`);
});
