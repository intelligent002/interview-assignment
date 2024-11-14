import {Consumer} from 'kafkajs';
import {KAFKA_CONSUMER_GROUP, KAFKA_TOPIC_CITIES, KAFKA_TOPIC_STREETS} from '../config';
import {handleCity} from "./handlers/handleCity";
import {handleStreet} from "./handlers/handleStreet";
import {Collection, Document} from "mongodb";
import Redis from "ioredis";
import Bottleneck from "bottleneck";
import {kafka} from "./kafka";
import logger from "../logger";

let consumer: Consumer;

export async function kafkaConsumerConnect() {

    // Prepare consumer
    consumer = kafka.consumer({
        groupId: KAFKA_CONSUMER_GROUP
    });
    // Connect consumer
    await consumer.connect();

    // Report
    logger.info('Kafka consumer connected.');
}

// Combo method
export async function kafkaConsume(
    {
        mongo,
        throttler,
        redisClient
    }:
    {
        mongo: Collection<Document>,
        throttler: Bottleneck,
        redisClient: Redis
    }) {

    // Connect
    await kafkaConsumerConnect()

    // Subscribe
    await consumer.subscribe({topic: KAFKA_TOPIC_CITIES, fromBeginning: false});
    await consumer.subscribe({topic: KAFKA_TOPIC_STREETS, fromBeginning: false});

    // run
    await consumer.run({
        eachMessage: async ({topic, message}) => {
            const messageContent = message.value?.toString();
            if (!messageContent) {
                logger.error('Received an empty message from kafka');
                return;
            }

            // what are we actually doing
            switch (topic) {
                case KAFKA_TOPIC_CITIES:
                    try {
                        await throttler.schedule(() => handleCity({message, redisClient}));
                    } catch (error) {
                        logger.error('Error scheduling handleCity:', error);
                    }
                    break;
                case KAFKA_TOPIC_STREETS:
                    try {
                        await throttler.schedule(() => handleStreet({message, redisClient, mongo}));
                    } catch (error) {
                        logger.error('Error scheduling handleStreet:', error);
                    }
                    break;
                default:
                    logger.error(`Received message for unexpected topic: [${topic}]`);
            }
        },
    });

    // report
    logger.info('Kafka consumer is running');
}

// Gracefully disconnect
export async function kafkaConsumerDisconnect() {
    if (consumer) {
        await consumer.disconnect();
    }
    logger.info('Kafka Consumer disconnected.');
}