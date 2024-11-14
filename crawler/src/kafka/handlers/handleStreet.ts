import {ErrorEmptyResponse, ErrorRateLimit, StreetsService} from 'data-gov-il-client';
import {kafkaProduce} from '../kafkaProducer';
import {KafkaMessage} from 'kafkajs';
import {KAFKA_TOPIC_STREETS, KAFKA_TOPIC_STREETS_DLQ, KAFKA_TOPIC_STREETS_THRESHOLD} from "../../config";
import {metricCounterStreets} from "../../metrics";
import {Collection, Document} from "mongodb";
import {registerRateLimitFailure, registerRateLimitSuccess} from "../../throttler/rateAdjust";
import Redis from "ioredis";
import logger from "../../logger";

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
    const attempt: number = message.headers?.attempts ? parseInt(message.headers.attempts.toString()) : 1;
    logger.info(`Handling street [${streetId}], attempt [${attempt}/${KAFKA_TOPIC_STREETS_THRESHOLD}]`);

    try {
        const response = await StreetsService.getStreetInfoById(streetId);
        await mongo.insertOne(response);
        metricCounterStreets.inc({status: 'OK'});
        await registerRateLimitSuccess(redisClient);
    } catch (error) {

        if (error instanceof ErrorEmptyResponse) {
            logger.warn('Caught an ErrorEmptyResponse, no further action needed.');
            metricCounterStreets.inc({status: 'Error-Empty'});
            await registerRateLimitSuccess(redisClient);
            return; // don`t do anything, street not found or the like
        }

        if (error instanceof ErrorRateLimit) {
            logger.warn('Caught an ErrorRateLimit, re-queue with same attempt #');
            metricCounterStreets.inc({status: 'Error-RateLimited'});
            await registerRateLimitFailure(redisClient);
            await kafkaProduce({
                topic: KAFKA_TOPIC_STREETS, messages: [streetId.toString()], attempt: (attempt).toString()
            });
            return;
        }

        // Handle other recoverable errors with retry logic that leads to Dead Letter Queue
        if (attempt < KAFKA_TOPIC_STREETS_THRESHOLD) {
            // requeue with incremented attempt #
            logger.info(`Re-queue message, attempt [${attempt}]/[${KAFKA_TOPIC_STREETS_THRESHOLD}]`);
            metricCounterStreets.inc({status: 'Error-Recoverable'});
            await kafkaProduce({
                topic: KAFKA_TOPIC_STREETS, messages: [streetId.toString()], attempt: (attempt + 1).toString()
            });
        } else {
            // DLQ
            logger.warn('Max retry attempts reached. Moving message to DLQ');
            metricCounterStreets.inc({status: 'Error-DLQ'});
            await kafkaProduce({
                topic: KAFKA_TOPIC_STREETS_DLQ, messages: [streetId.toString()], attempt: (attempt + 1).toString()
            });
        }
    }
}
