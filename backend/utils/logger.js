const pino = require('pino');

const REDACTED_FIELDS = ['password', 'token', 'authorization', 'card', 'cvv', 'secret'];

function redact(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = { ...obj };
  for (const key of REDACTED_FIELDS) {
    if (key in out) out[key] = '[REDACTED]';
  }
  return out;
}

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  serializers: {
    err: pino.stdSerializers.err,
    req: (req) => redact({
      method: req.method,
      url: req.url,
    }),
  },
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  } : undefined,
});

module.exports = logger;
