import {Admin, Kafka} from 'kafkajs';
import {
    KAFKA_APP,
    KAFKA_BROKER,
    KAFKA_PARTITIONS,
    KAFKA_TOPIC_CITIES,
    KAFKA_TOPIC_CITIES_DLQ,
    KAFKA_TOPIC_STREETS,
    KAFKA_TOPIC_STREETS_DLQ
} from '../config';

let kafka: Kafka;
let admin: Admin;

export async function kafkaAdminInit() {
    // Who am I, where am I going to?
    console.log('will talk to kafka on [' + KAFKA_BROKER + ']');

    // Here we go ...
    kafka = new Kafka({
        clientId: KAFKA_APP,
        brokers: [KAFKA_BROKER]
    });

    // Prepare to admin
    admin = kafka.admin()

    try {
        // Connect to Admin
        await admin.connect();

        // Create topics
        await createTopic({topic: KAFKA_TOPIC_CITIES, numPartitions: KAFKA_PARTITIONS});
        await createTopic({topic: KAFKA_TOPIC_CITIES_DLQ, numPartitions: KAFKA_PARTITIONS});
        await createTopic({topic: KAFKA_TOPIC_STREETS, numPartitions: KAFKA_PARTITIONS});
        await createTopic({topic: KAFKA_TOPIC_STREETS_DLQ, numPartitions: KAFKA_PARTITIONS});

    } catch (error) {
        console.error('Error during Kafka initialization:', error);
    } finally {
        // Disconnect the admin client after creating topics
        await admin.disconnect();
    }
}

// Function to create a topic
async function createTopic(
    {
        topic,
        numPartitions
    }: {
        topic: string,
        numPartitions: number
    }) {
    try {
        // Check if the topic already exists
        const existingTopics = await admin.listTopics();
        if (existingTopics.includes(topic)) {
            console.log(`Topic [${topic}] already exists.`);
            return;
        }

        // Create the topic configuration
        const topicConfig = {
            topic,                  // The name of the topic
            numPartitions,          // The number of partitions
            replicationFactor: 1,   // The replication factor (ensure the cluster has enough brokers)
        };

        const result = await admin.createTopics({
            topics: [topicConfig],
            waitForLeaders: true,   // Wait for leaders to be elected before returning
        });

        if (result) {
            console.log(`Topic [${topic}] created successfully.`);
        } else {
            console.log(`Topic [${topic}] creation did not occur, possibly already exists.`);
        }
    } catch (error) {
        console.error(`Error creating topic [${topic}]:`, error);
    }
}
