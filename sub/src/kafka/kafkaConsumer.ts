import {Kafka} from 'kafkajs';
import {KAFKA_APP, KAFKA_BROKER, KAFKA_CONSUMER_GROUP, KAFKA_TOPIC_CITIES, KAFKA_TOPIC_STREETS} from '../config';
import {handleCity} from "./handlers/handleCity";
import {handleStreet} from "./handlers/handleStreet";
import {Collection} from "mongodb";

const kafka = new Kafka({
    clientId: KAFKA_APP,
    brokers: [KAFKA_BROKER],
});

export async function consumeFromKafka(mongoCollection: Collection) {
    const consumer = kafka.consumer({
        groupId: KAFKA_CONSUMER_GROUP
    });
    await consumer.connect();
    await consumer.subscribe({topic: KAFKA_TOPIC_CITIES, fromBeginning: false});
    await consumer.subscribe({topic: KAFKA_TOPIC_STREETS, fromBeginning: false});

    await consumer.run({
        eachMessage: async ({topic, message}) => {
            const messageContent = message.value?.toString();
            if (!messageContent) {
                console.error('Received an empty message');
                return;
            }

            // what are we actually doing
            switch (topic) {
                case KAFKA_TOPIC_CITIES:
                    await handleCity(message);
                    break;
                case KAFKA_TOPIC_STREETS:
                    await handleStreet(message, mongoCollection);
                    break;
                default:
                    console.warn(`Received message for unexpected topic: [${topic}]`);
            }
        },
    });

    console.log('Kafka consumer is running');
}