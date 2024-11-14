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

// combo function
export async function kafkaAdmin() {
    try {
        await kafkaAdminConnect();
        await kafkaAdminInit();
        await kafkaAdminDisconnect();
    } catch (error) {
        console.log("Error in kafkaAdmin(): ", error);
    } finally {
        console.log("Done with administrative preparations.")
    }
}

async function kafkaAdminConnect() {
    // Prepare Admin
    admin = kafka.admin()
    // Connect Admin
    await admin.connect();
    console.log('Kafka admin connected.');
}

// Create required applicative topics
async function kafkaAdminInit() {

    // Create topics
    await kafkaCreateTopic({topic: KAFKA_TOPIC_CITIES, numPartitions: KAFKA_TOPIC_CITIES_PARTITIONS});
    await kafkaCreateTopic({topic: KAFKA_TOPIC_CITIES_DLQ, numPartitions: KAFKA_TOPIC_CITIES_PARTITIONS});
    await kafkaCreateTopic({topic: KAFKA_TOPIC_STREETS, numPartitions: KAFKA_TOPIC_STREETS_PARTITIONS});
    await kafkaCreateTopic({topic: KAFKA_TOPIC_STREETS_DLQ, numPartitions: KAFKA_TOPIC_STREETS_PARTITIONS});
}

// Function that creates a topic
async function kafkaCreateTopic(
    {
        topic,
        numPartitions
    }: {
        topic: string,
        numPartitions: number
    }) {
    try {
        // Check if the topic already exists
        const topics = await admin.listTopics();
        if (topics.includes(topic)) {
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

// Gracefully disconnect
export async function kafkaAdminDisconnect() {
    if (admin) {
        await admin.disconnect();
        console.log('Kafka Admin disconnected.');
    }
}