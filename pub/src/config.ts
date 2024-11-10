export const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';
export const KAFKA_APP = process.env.KAFKA_APP || 'streets-demo-app';
export const KAFKA_TOPIC_CITIES = process.env.KAFKA_TOPIC_CITIES || 'topic-cities';
export const KAFKA_TOPIC_CITIES_DLQ = process.env.KAFKA_TOPIC_CITIES_DLQ || 'topic-cities-dlq';
export const KAFKA_TOPIC_STREETS = process.env.KAFKA_TOPIC_STREETS || 'topic-streets';
export const KAFKA_TOPIC_STREETS_DLQ = process.env.KAFKA_TOPIC_STREETS_DLQ || 'topic-streets-dlq';
export const KAFKA_PARTITIONS = parseInt(process.env.KAFKA_PARTITIONS || '3');
