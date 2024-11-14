import {Producer} from 'kafkajs';
import {kafka} from "./kafka";

let producer: Producer;

// Connect to kafka with idempotency
export async function kafkaProducerConnect() {

    // Prepare producer
    producer = kafka.producer({
        idempotent: true,
        maxInFlightRequests: 5, // Ensures no more than 5 in-flight requests to maintain idempotency
    });

    // Connect Producer
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
            return; // return if successful
        } catch (error) {
            if (retry <= retries) {
                console.warn(`Retrying to send messages to Kafka, retry [${retry}/${retries}]...`);
                await new Promise(resolve => setTimeout(resolve, delay * retry)); // Exponential backoff
            } else {
                console.error('All retry attempts exhausted, i give up ... kafka is simply unavailable.');
            }
        }
    }
}

// Produce once
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

// Gracefully disconnect
export async function kafkaProducerDisconnect() {
    if (producer) {
        await producer.disconnect();
        console.log('Kafka producer disconnected.');
    }
}