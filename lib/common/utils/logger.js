import winston from 'winston';

const isProd = process.env.NODE_ENV === 'production';

const logger = winston.createLogger({
  level: isProd ? 'info' : 'silly',
  format: winston.format.json(),
  transports: [
    //
    // - Write all logs with level `error` and below to `error.log`
    // - Write all logs with level `info` and below to `combined.log`
    //
    new winston.transports.File({filename: 'error.log', level: 'error'}),
    new winston.transports.File({filename: 'combined.log'}),
    new winston.transports.Console({
      colorize: { all: true },
      handleExceptions: true,
      humanReadableUnhandledException: true,
      format: winston.format.simple(),
      //format: winston.format.simple(),
    }),
  ],
});

export default logger;
