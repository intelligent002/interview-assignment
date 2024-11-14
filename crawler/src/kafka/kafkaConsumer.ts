import {Kafka} from 'kafkajs';
import {KAFKA_APP, KAFKA_BROKER, KAFKA_CONSUMER_GROUP, KAFKA_TOPIC_CITIES, KAFKA_TOPIC_STREETS} from '../config';
import {handleCity} from "./handlers/handleCity";
import {handleStreet} from "./handlers/handleStreet";
import {Collection, Document} from "mongodb";
import Redis from "ioredis";
import Bottleneck from "bottleneck";

const kafka = new Kafka({
    clientId: KAFKA_APP, brokers: [KAFKA_BROKER],
});

export async function consumeFromKafka(
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
    const consumer = kafka.consumer({
        groupId: KAFKA_CONSUMER_GROUP
    });
    await consumer.connect();
    await consumer.subscribe({topic: KAFKA_TOPIC_CITIES, fromBeginning: false});
    await consumer.subscribe({topic: KAFKA_TOPIC_STREETS, fromBeginning: false});

    await consumer.run({
        eachMessage: async ({topic, message}) => {
            const messageContent = message.value?.toString();
            if (!messageContent) {
                console.error('Received an empty message');
                return;
            }

            // what are we actually doing
            switch (topic) {
                case KAFKA_TOPIC_CITIES:
                    try {
                        await throttler.schedule(() => handleCity({message, redisClient}));
                    } catch (error) {
                        console.error('Error scheduling handleCity:', error);
                    }
                    break;
                case KAFKA_TOPIC_STREETS:
                    try {
                        await throttler.schedule(() => handleStreet({message, redisClient, mongo}));
                    } catch (error) {
                        console.error('Error scheduling handleStreet:', error);
                    }
                    break;
                default:
                    console.warn(`Received message for unexpected topic: [${topic}]`);
            }
        },
    });

    console.log('Kafka consumer is running');
}