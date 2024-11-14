import {Consumer} from 'kafkajs';
import {KAFKA_CONSUMER_GROUP, KAFKA_TOPIC_CITIES, KAFKA_TOPIC_STREETS} from '../config';
import {handleCity} from "./handlers/handleCity";
import {handleStreet} from "./handlers/handleStreet";
import {Collection, Document} from "mongodb";
import Redis from "ioredis";
import Bottleneck from "bottleneck";
import {kafka} from "./kafka";

let consumer: Consumer;

export async function kafkaConsumerConnect() {
    // Prepare Consumer
    consumer = kafka.consumer({
        groupId: KAFKA_CONSUMER_GROUP
    });
    // Connect Consumer
    await consumer.connect();
    console.log('Kafka consumer connected.');
}

// combo function
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

    // connect
    await kafkaConsumerConnect();

    // subscribe
    await consumer.subscribe({topic: KAFKA_TOPIC_CITIES, fromBeginning: false});
    await consumer.subscribe({topic: KAFKA_TOPIC_STREETS, fromBeginning: false});

    // run
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

// Gracefully disconnect
export async function kafkaConsumerDisconnect() {
    if (consumer) {
        await consumer.disconnect();
        console.log('Kafka Consumer disconnected.');
    }
}