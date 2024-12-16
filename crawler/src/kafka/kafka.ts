import {Kafka, LogEntry, logLevel} from "kafkajs";
import {KAFKA_APP, KAFKA_BROKER, LOG_LEVEL} from "../config";
import logger from "../logger";

const customLogCreator = () => {
    const logLevels: { [key in logLevel]: string } = {
        [logLevel.NOTHING]: 'silent',
        [logLevel.ERROR]: 'error',
        [logLevel.WARN]: 'warn',
        [logLevel.INFO]: 'info',
        [logLevel.DEBUG]: 'debug',
    };

    return (logEntry: LogEntry) => {
        const {namespace, level, label, log} = logEntry;
        const {message, ...extra} = log;
        const levelName = logLevels[level] || 'info';

        logger.log({
            level: levelName,
            message: `${namespace} [${label}]: ${message}`,
            ...extra, // Spread the extra properties
        });
    };
};

const kafkaLogLevels: { [key: string]: logLevel } = {
    silent: logLevel.NOTHING,
    error: logLevel.ERROR,
    warn: logLevel.WARN,
    info: logLevel.INFO,
    debug: logLevel.DEBUG,
};

const kafkaBrokers = KAFKA_BROKER.split(',');
export const kafka = new Kafka({
    clientId: KAFKA_APP,
    brokers: kafkaBrokers,
    logLevel: kafkaLogLevels[LOG_LEVEL] || logLevel.INFO,
    logCreator: customLogCreator,
});
