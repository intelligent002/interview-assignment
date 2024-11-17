import {StreetsService} from 'data-gov-il-client';
import {KafkaMessage} from 'kafkajs';
import {KAFKA_TOPIC_STREETS, KAFKA_TOPIC_STREETS_DLQ, KAFKA_TOPIC_STREETS_THRESHOLD} from "../../config";
import {metricCounterStreets} from "../../metrics";
import Redis from "ioredis";
import {handleWithRetries} from "./handleWithRetries";
import {Collection, Document} from "mongodb";

export async function handleStreet(
    {
        message,
        redisClient,
        mongo
    }: {
        message: KafkaMessage,
        redisClient: Redis,
        mongo: Collection<Document>
    }
) {
    const streetId: number = parseInt((message.value ?? '').toString());
    await handleWithRetries({
        message,
        redisClient,
        topic: KAFKA_TOPIC_STREETS,
        dlqTopic: KAFKA_TOPIC_STREETS_DLQ,
        threshold: KAFKA_TOPIC_STREETS_THRESHOLD,
        metricCounter: metricCounterStreets,
        processFunction: async () => {
            const response = await StreetsService.getStreetInfoById(streetId);
            await mongo.insertOne(response);
        }
    });
}