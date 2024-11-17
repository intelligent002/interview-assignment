import {ErrorEmptyResponse, ErrorRateLimit} from 'data-gov-il-client';
import {kafkaProduce} from '../kafkaProducer';
import {KafkaMessage} from 'kafkajs';
import {registerRateLimitFailure, registerRateLimitSuccess} from '../../throttler/rateAdjust';
import Redis from 'ioredis';
import logger from '../../logger';
import client from "prom-client";

// Wrapper function to handle retries, error and logs
export async function handleWithRetries(
    {
        message,
        redisClient,
        topic,
        dlqTopic,
        threshold,
        metricCounter,
        processFunction
    }: {
        message: KafkaMessage,
        redisClient: Redis,
        topic: string,
        dlqTopic: string,
        threshold: number,
        metricCounter: client.Counter, // Replace with the actual type if available
        processFunction: () => Promise<void>
    }
) {
    const attempt: number = message.headers?.attempts ? parseInt(message.headers.attempts.toString()) : 1;
    logger.info(`Processing message, attempt [${attempt}/${threshold}]`);

    try {
        await processFunction();
        metricCounter.inc({status: 'OK'});
        await registerRateLimitSuccess(redisClient);
    } catch (error) {
        if (error instanceof ErrorEmptyResponse) {
            logger.info('Caught an ErrorEmptyResponse, no further action needed.');
            metricCounter.inc({status: 'empty'});
            await registerRateLimitSuccess(redisClient);
            return;
        }

        if (error instanceof ErrorRateLimit) {
            logger.warn('Caught an ErrorRateLimit, re-queueing with the same attempt #');
            metricCounter.inc({status: 'Error-RateLimited'});
            await registerRateLimitFailure(redisClient);
            await kafkaProduce({
                topic,
                messages: [message.value?.toString() ?? ''],
                attempt: attempt.toString()
            });
            return;
        }

        if (attempt < threshold) {
            logger.info(`Re-queueing message, attempt [${attempt}/${threshold}]`);
            metricCounter.inc({status: 'Error-Recoverable'});
            await kafkaProduce({
                topic,
                messages: [message.value?.toString() ?? ''],
                attempt: (attempt + 1).toString()
            });
        } else {
            logger.warn('Max retry attempts reached. Moving message to DLQ');
            metricCounter.inc({status: 'Error-DLQ'});
            await kafkaProduce({
                topic: dlqTopic,
                messages: [message.value?.toString() ?? ''],
                attempt: (attempt + 1).toString()
            });
        }
    }
}