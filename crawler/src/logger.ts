import {createLogger, format, transports} from 'winston';
import {KAFKA_APP, LOG_LEVEL} from "./config";

const {combine, timestamp, errors, json} = format;

const logger = createLogger({
    level: (LOG_LEVEL || 'info').toLowerCase(),
    format: combine(
        timestamp(),
        errors({stack: true}),
        json()
    ),
    defaultMeta: {service: KAFKA_APP},
    transports: [new transports.Console()],
});

// Export the logger instance
export default logger;
