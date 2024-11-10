import {city, ErrorEmptyResponse, ErrorRateLimit, StreetsService} from 'data-gov-il-client';
import {kafkaProduce} from '../kafkaProducer';
import {KafkaMessage} from 'kafkajs';
import {
    KAFKA_TOPIC_CITIES, KAFKA_TOPIC_CITIES_DLQ, KAFKA_TOPIC_CITIES_THRESHOLD,
    KAFKA_TOPIC_STREETS,
    KAFKA_TOPIC_STREETS_DLQ,
    KAFKA_TOPIC_STREETS_THRESHOLD
} from "../../config";

export async function handleCity(message: KafkaMessage) {

    const cityName = <city>(message.value ?? '').toString();
    const attempt: number = message.headers?.attempts ? parseInt(message.headers.attempts.toString()) : 0;
    console.log(`Handling city [${cityName}], attempt [${attempt}]`);

    try {
        const response = await StreetsService.getStreetsInCity(cityName, 10);
        const streetIds = response.streets.map((street) => street.streetId.toString());

        // Push all received street IDs to the "streets" topic
        await kafkaProduce({
            topic: KAFKA_TOPIC_STREETS,
            messages: streetIds
        });
        console.log('Done')
    } catch (error) {

        if (error instanceof ErrorEmptyResponse) {
            console.error('Caught an ErrorEmptyResponse, no further action needed.');
            return; // don`t do anything, no such city or no streets in that city
        }

        if (error instanceof ErrorRateLimit) {
            console.error('Caught an ErrorRateLimit, re-queue with same attempt #');
            await kafkaProduce({
                topic: KAFKA_TOPIC_CITIES,
                messages: [cityName],
                attempt: (attempt).toString()
            });
            return;
        }

        // Handle other recoverable errors with retry logic that leads to Dead Letter Queue
        if (attempt < KAFKA_TOPIC_CITIES_THRESHOLD) {
            // requeue with incremented attempt #
            console.log(`Re-queue message, attempt [${attempt}]/[${KAFKA_TOPIC_CITIES_THRESHOLD}]`);
            await kafkaProduce({
                topic: KAFKA_TOPIC_CITIES,
                messages: [cityName],
                attempt: (attempt + 1).toString()
            });
        } else {
            // DLQ
            console.warn('Max retry attempts reached. Moving message to DLQ');
            await kafkaProduce({
                topic: KAFKA_TOPIC_CITIES_DLQ,
                messages: [cityName],
                attempt: (attempt + 1).toString()
            });
        }
    }
}
