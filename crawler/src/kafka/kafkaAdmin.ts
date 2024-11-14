import {Admin} from 'kafkajs';
import {
    KAFKA_TOPIC_CITIES,
    KAFKA_TOPIC_CITIES_DLQ,
    KAFKA_TOPIC_CITIES_PARTITIONS,
    KAFKA_TOPIC_STREETS,
    KAFKA_TOPIC_STREETS_DLQ,
    KAFKA_TOPIC_STREETS_PARTITIONS
} from '../config';
import {kafka} from "./kafka";

let admin: Admin;

// Combo method
export async function kafkaAdmin() {
    try {
        await kafkaAdminConnect();
        await kafkaAdminInit();
        await kafkaAdminDisconnect();
    } catch (error) {
        console.error("Error during kafkaAdmin: ", error);
    }
}

// connect
async function kafkaAdminConnect() {

    // Prepare Admin
    admin = kafka.admin();

    // Connect Admin
    await admin.connect();

    // Report
    console.log('Kafka admin connected.');
}

// init topics
async function kafkaAdminInit() {
    try {
        // Create topics
        await createTopic({topic: KAFKA_TOPIC_CITIES, numPartitions: KAFKA_TOPIC_CITIES_PARTITIONS});
        await createTopic({topic: KAFKA_TOPIC_CITIES_DLQ, numPartitions: KAFKA_TOPIC_CITIES_PARTITIONS});
        await createTopic({topic: KAFKA_TOPIC_STREETS, numPartitions: KAFKA_TOPIC_STREETS_PARTITIONS});
        await createTopic({topic: KAFKA_TOPIC_STREETS_DLQ, numPartitions: KAFKA_TOPIC_STREETS_PARTITIONS});
    } catch (error) {
        console.error('Error during Kafka topics creation:', error);
    }
}

// create a topic
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

// Graceful shutdown
export async function kafkaAdminDisconnect() {
    await admin.disconnect();
    console.log("Kafka Admin gracefully disconnected");
}