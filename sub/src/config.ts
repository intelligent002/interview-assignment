export const KAFKA_APP = process.env.KAFKA_APP || 'streets-demo-app';
export const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';
export const KAFKA_CONSUMER_GROUP = process.env.KAFKA_TOPIC_STREETS || 'topic-streets';
export const KAFKA_TOPIC_CITIES = process.env.KAFKA_TOPIC_CITIES || 'topic-cities';
export const KAFKA_TOPIC_CITIES_DLQ = process.env.KAFKA_TOPIC_CITIES_DLQ || 'topic-cities-dlq';
export const KAFKA_TOPIC_CITIES_THRESHOLD = parseInt(process.env.KAFKA_TOPIC_CITIES_THRESHOLD as string) || 1;
export const KAFKA_TOPIC_STREETS = process.env.KAFKA_TOPIC_STREETS || 'topic-streets';
export const KAFKA_TOPIC_STREETS_DLQ = process.env.KAFKA_TOPIC_STREETS_DLQ || 'topic-streets-dlq';
export const KAFKA_TOPIC_STREETS_THRESHOLD = parseInt(process.env.KAFKA_TOPIC_STREETS_THRESHOLD as string) || 1;
export const MONGO_COLLECTION = 'streets';
export const MONGO_DB_NAME = process.env.MONGO_DB_NAME || 'streetDB';
export const MONGO_DSN = process.env.MONGO_DSN || 'mongodb://localhost:27017';
export const PROMETHEUS_METRICS_PORT = parseInt(process.env.PROMETHEUS_METRICS_PORT as string) || 8080;
export const RATE_LIMIT_ADJUST_EVERY_SECONDS = parseInt(process.env.RATE_LIMIT_ADJUST_EVERY_SECONDS as string) || 10;
export const RATE_LIMIT_GLOBAL_MAX = parseInt(process.env.RATE_LIMIT_GLOBAL_MAX as string) || 1000;
export const RATE_LIMIT_GLOBAL_MIN = parseInt(process.env.RATE_LIMIT_GLOBAL_MIN as string) || 10;
export const RATE_LIMIT_REDIS_FAILURE = process.env.RATE_LIMIT_REDIS_FAILURE || 'count_failure';
export const RATE_LIMIT_REDIS_LIMIT = process.env.RATE_LIMIT_REDIS_LIMIT || 'global_limit';
export const RATE_LIMIT_REDIS_SUCCESS = process.env.RATE_LIMIT_REDIS_SUCCESS || 'count_success';
export const REDIS_BASE = process.env.REDIS_BASE || '';
export const REDIS_HOST = process.env.REDIS_HOST || '';
export const REDIS_PASS = process.env.REDIS_PASS || '';
export const REDIS_PORT = parseInt(process.env.REDIS_PORT as string) || 6379;
export const REDIS_UPDATES_CHANNEL = process.env.REDIS_UPDATES_CHANNEL || 'rate-limit-updates';
export const REDIS_UPDATES_MESSAGE = process.env.REDIS_UPDATES_MESSAGE || 'update';
export const REDIS_USER = process.env.REDIS_USER || '';
