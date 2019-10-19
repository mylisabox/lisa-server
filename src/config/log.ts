/**
 * Logging Configuration
 * (app.config.log)
 * include spool-winston in config.main.spools
 * @see http://fabrix.app/doc/config/log
 */

import * as winston from 'winston'

export const log = {
    level: 'debug',
    exitOnError: true,
    format: winston.format.combine(
        winston.format.colorize({all: true}),
        winston.format.cli(),
    ),
    transports: [
        new winston.transports.Console()
    ]
}
