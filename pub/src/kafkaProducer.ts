import { Kafka } from 'kafkajs';
import { KAFKA_BROKER, KAFKA_TOPIC } from './config';

const kafka = new Kafka({
    clientId: 'street-app',
    brokers: [KAFKA_BROKER]
});

const producer = kafka.producer();

export const sendToKafka = async (messages: string[]): Promise<void> => {
    await producer.connect();
    const payload = messages.map((street) => ({
        key: street,
        value: street
    }));

    await producer.send({
        topic: KAFKA_TOPIC,
        messages: payload
    });

    console.log('Messages sent to Kafka:', messages);
    await producer.disconnect();
};
