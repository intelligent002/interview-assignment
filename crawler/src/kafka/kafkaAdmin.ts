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
import logger from "../logger";

let admin: Admin;

// Combo method
export async function kafkaAdmin() {
    try {
        await kafkaAdminConnect();
        await kafkaAdminInit();
        await kafkaAdminDisconnect();
    } catch (error) {
        logger.error("Error during kafkaAdmin: ", error);
    }
}

// connect
async function kafkaAdminConnect() {

    // Prepare Admin
    admin = kafka.admin();

    // Connect Admin
    await admin.connect();

    // Report
    logger.info('Kafka admin connected.');
}

// init topics
async function kafkaAdminInit() {

    // Create topics
    await kafkaCreateTopic({topic: KAFKA_TOPIC_CITIES, numPartitions: KAFKA_TOPIC_CITIES_PARTITIONS});
    await kafkaCreateTopic({topic: KAFKA_TOPIC_CITIES_DLQ, numPartitions: 1}); // memory constraints
    await kafkaCreateTopic({topic: KAFKA_TOPIC_STREETS, numPartitions: KAFKA_TOPIC_STREETS_PARTITIONS});
    await kafkaCreateTopic({topic: KAFKA_TOPIC_STREETS_DLQ, numPartitions: 1}); // memory constraints

    return true;
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
            logger.info(`Topic [${topic}] already exists.`);
            return;
        }

        // Create the topic configuration
        const topicConfig = {
            topic,                  // The name of the topic
            numPartitions,          // The number of partitions
            replicationFactor: 3,   // The replication factor (ensure the cluster has enough brokers)
        };

        const result = await admin.createTopics({
            topics: [topicConfig],
            waitForLeaders: true,   // Wait for leaders to be elected before returning
        });

        if (result) {
            logger.info(`Topic [${topic}] created successfully.`);
        } else {
            logger.info(`Topic [${topic}] creation did not occur, possibly already exists.`);
        }
    } catch (error) {
        logger.error(`Error creating topic [${topic}]:`, error);
    }
}

// Graceful shutdown
export async function kafkaAdminDisconnect() {
    if (admin) {
        await admin.disconnect();
    }
    logger.info("Kafka Admin disconnected");
}