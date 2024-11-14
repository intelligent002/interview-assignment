import {Producer} from 'kafkajs';
import {kafka} from "./kafka";

let producer: Producer;

// Function to initialize and connect the Kafka producer with idempotency
export async function kafkaProducerConnect() {

    // Prepare producer
    producer = kafka.producer({
        idempotent: true,
        maxInFlightRequests: 5, // Ensures no more than 5 in-flight requests to maintain idempotency
    });

    // Connect producer
    await producer.connect();

    // Report
    console.log('Kafka producer connected with idempotency enabled.');
}

// Produce with retries
export async function kafkaProduce(
    {
        topic,
        messages,
        attempt = '0',
        retries = 3,
        delay = 1000
    }: {
        topic: string,
        messages: string[],
        attempt?: string,
        retries?: number,
        delay?: number
    }) {
    for (let retry = 1; retry <= retries; retry++) {
        try {
            await kafkaProduceOnce({topic, messages, attempt});
            return; // Exit if successful
        } catch (error) {
            if (retry <= retries) {
                console.warn(`Retrying to send messages to Kafka, retry [${retry}/${retries}]...`);
                await new Promise(resolve => setTimeout(resolve, delay * retry)); // Exponential backoff
            } else {
                console.error('All retry attempts failed, i give up ... kafka is unavailable:', error);
            }
        }
    }
}

// send once
async function kafkaProduceOnce(
    {
        topic,
        messages,
        attempt
    }: {
        topic: string,
        messages: string[],
        attempt: string
    }): Promise<void> {

    const payload = messages.map((street) => ({
        key: street, value: street, headers: {attempt}
    }));

    await producer.send({
        topic, messages: payload
    });

    console.log('Message(s) sent to Kafka:', messages);
}

// Function to gracefully disconnect the producer
export async function kafkaProducerDisconnect() {
    if (producer) {
        await producer.disconnect();
        console.log('Kafka producer disconnected.');
    }
}