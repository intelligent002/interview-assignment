import {city, StreetsService} from 'data-gov-il-client';
import {kafkaProduce} from '../kafkaProducer';
import {KafkaMessage} from 'kafkajs';
import {
    KAFKA_TOPIC_CITIES,
    KAFKA_TOPIC_CITIES_DLQ,
    KAFKA_TOPIC_CITIES_THRESHOLD,
    KAFKA_TOPIC_STREETS,
} from "../../config";
import {metricsCounterCities} from "../../metrics";
import Redis from "ioredis";
import logger from "../../logger";
import {handleWithRetries} from "./handleWithRetries";

export async function handleCity(
    {
        message,
        redisClient
    }: {
        message: KafkaMessage,
        redisClient: Redis
    }
) {
    let cityName: city = '' as city;
    try {
        cityName = <city>(message.value ?? '').toString();
        await handleWithRetries({
            message,
            redisClient,
            topic: KAFKA_TOPIC_CITIES,
            dlqTopic: KAFKA_TOPIC_CITIES_DLQ,
            threshold: KAFKA_TOPIC_CITIES_THRESHOLD,
            metricCounter: metricsCounterCities,
            processFunction: async () => {
                const response = await StreetsService.getStreetsInCity(cityName, 1_000_000);
                const streetIds = response.streets.map(street => street.streetId.toString());
                await kafkaProduce({
                    topic: KAFKA_TOPIC_STREETS,
                    messages: streetIds
                });
            }
        });
    } catch (error) {
        logger.error(`Illegal city received: [${cityName}], ignoring`)
    }
}

