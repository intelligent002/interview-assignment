import { Kafka } from 'kafkajs';
import { KAFKA_BROKER, KAFKA_TOPIC } from './config';

const kafka = new Kafka({
    clientId: 'street-app',
    brokers: [KAFKA_BROKER],
});

export const consumeFromKafka = async (callback: (message: string) => Promise<void>) => {
    const consumer = kafka.consumer({ groupId: 'street-group' });
    await consumer.connect();
    await consumer.subscribe({ topic: KAFKA_TOPIC, fromBeginning: true });

    await consumer.run({
        eachMessage: async ({ message }) => {
            const streetId = message.value?.toString();
            if (streetId) {
                console.log('Received street ID:', streetId);
                await callback(streetId);
            }
        },
    });

    console.log('Kafka consumer is running');
};
