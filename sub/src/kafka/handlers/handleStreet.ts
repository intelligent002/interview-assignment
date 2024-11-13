import {ErrorEmptyResponse, ErrorRateLimit, StreetsService} from 'data-gov-il-client';
import {kafkaProduce} from '../kafkaProducer';
import {KafkaMessage} from 'kafkajs';
import {KAFKA_TOPIC_STREETS, KAFKA_TOPIC_STREETS_DLQ, KAFKA_TOPIC_STREETS_THRESHOLD} from "../../config";
import {counterStreets} from "../../metrics";
import {Collection, Document} from "mongodb";
import {registerRateLimitFailure, registerRateLimitSuccess} from "../../throttler/rateAdjust";
import Redis from "ioredis";

export async function handleStreet(
    {
        message,
        redisClient,
        mongo
    }: {
        message: KafkaMessage,
        redisClient: Redis,
        mongo: Collection<Document>,
    }) {
    const streetId: number = parseInt((message.value ?? '').toString());
    const attempt: number = message.headers?.attempts ? parseInt(message.headers.attempts.toString()) : 0;
    console.log(`Handling street [${streetId}], attempt [${attempt}/${KAFKA_TOPIC_STREETS_THRESHOLD}]`);

    try {
        const response = await StreetsService.getStreetInfoById(streetId);
        await mongo.insertOne(response);
        counterStreets.inc({status: 'OK'});
        await registerRateLimitSuccess(redisClient);
    } catch (error) {

        if (error instanceof ErrorEmptyResponse) {
            console.error('Caught an ErrorEmptyResponse, no further action needed.');
            counterStreets.inc({status: 'empty'});
            await registerRateLimitSuccess(redisClient);
            return; // don`t do anything, street not found or the like
        }

        if (error instanceof ErrorRateLimit) {
            console.error('Caught an ErrorRateLimit, re-queue with same attempt #');
            counterStreets.inc({status: 'Error-RateLimited'});
            await registerRateLimitFailure(redisClient);
            await kafkaProduce({
                topic: KAFKA_TOPIC_STREETS, messages: [streetId.toString()], attempt: (attempt).toString()
            });
            return;
        }

        // Handle other recoverable errors with retry logic that leads to Dead Letter Queue
        if (attempt < KAFKA_TOPIC_STREETS_THRESHOLD) {
            // requeue with incremented attempt #
            console.log(`Re-queue message, attempt [${attempt}]/[${KAFKA_TOPIC_STREETS_THRESHOLD}]`);
            counterStreets.inc({status: 'Error-Recoverable'});
            await kafkaProduce({
                topic: KAFKA_TOPIC_STREETS, messages: [streetId.toString()], attempt: (attempt + 1).toString()
            });
        } else {
            // DLQ
            console.warn('Max retry attempts reached. Moving message to DLQ');
            counterStreets.inc({status: 'Error-DLQ'});
            await kafkaProduce({
                topic: KAFKA_TOPIC_STREETS_DLQ, messages: [streetId.toString()], attempt: (attempt + 1).toString()
            });
        }
    }
}
