import {ErrorEmptyResponse, ErrorRateLimit, StreetsService} from 'data-gov-il-client';
import {kafkaProduce} from '../kafkaProducer';
import {KafkaMessage} from 'kafkajs';
import {KAFKA_TOPIC_STREETS, KAFKA_TOPIC_STREETS_DLQ, KAFKA_TOPIC_STREETS_THRESHOLD} from "../../config";
import {incrementProcessedMessages} from "../../metrics";
import {Collection} from "mongodb";

export async function handleStreet(message: KafkaMessage, mongoCollection: Collection) {

    const streetId: number = parseInt((message.value ?? '').toString());
    const attempt: number = message.headers?.attempts ? parseInt(message.headers.attempts.toString()) : 0;
    console.log(`Handling street [${streetId}], attempt [${attempt}]`);

    try {
        const response = await StreetsService.getStreetInfoById(streetId);
        await mongoCollection.insertOne(response);
        console.log('Done')
        incrementProcessedMessages(); // Increment the counter for successful processing
    } catch (error) {

        if (error instanceof ErrorEmptyResponse) {
            console.error('Caught an ErrorEmptyResponse, no further action needed.');
            return; // don`t do anything, street not found or the like
        }

        if (error instanceof ErrorRateLimit) {
            console.error('Caught an ErrorRateLimit, re-queue with same attempt #');
            await kafkaProduce({
                topic: KAFKA_TOPIC_STREETS,
                messages: [streetId.toString()],
                attempt: (attempt).toString()
            });
            return;
        }

        // Handle other recoverable errors with retry logic that leads to Dead Letter Queue
        if (attempt < KAFKA_TOPIC_STREETS_THRESHOLD) {
            // requeue with incremented attempt #
            console.log(`Re-queue message, attempt [${attempt}]/[${KAFKA_TOPIC_STREETS_THRESHOLD}]`);
            await kafkaProduce({
                topic: KAFKA_TOPIC_STREETS,
                messages: [streetId.toString()],
                attempt: (attempt + 1).toString()
            });
        } else {
            // DLQ
            console.warn('Max retry attempts reached. Moving message to DLQ');
            await kafkaProduce({
                topic: KAFKA_TOPIC_STREETS_DLQ,
                messages: [streetId.toString()],
                attempt: (attempt + 1).toString()
            });
        }
    }
}
