import {mongoCollection, mongoDisconnect} from './mongoClient';
import {kafkaConsume, kafkaConsumerDisconnect} from './kafka/kafkaConsumer';
import {startMetricsServer} from './metrics';
import {kafkaProducerConnect, kafkaProducerDisconnect} from "./kafka/kafkaProducer";
import {getThrottler, updateThrottler} from "./throttler/rateLimit";
import {getRedisClient, getRedisSubscriber, redisDisconnect, redisSubscribe} from "./redis/redisConnectivity";
import {RATE_LIMIT_LEADER_DURATION, REDIS_UPDATES_CHANNEL, REDIS_UPDATES_MESSAGE} from "./config";
import {scheduleThrottlerAdjustments, unscheduleThrottlerAdjustments} from "./throttler/rateAdjust";
import {redisLeadership} from "./redis/redisLeadership";
import {kafkaAdmin, kafkaAdminDisconnect} from "./kafka/kafkaAdmin";
import {hostname} from "node:os";
import {Collection, Document} from "mongodb";
import Redis from "ioredis";

let mongo: Collection<Document>;
let redisClient: Redis;
let redisSubscriber: Redis;
let leader: redisLeadership;
let isShuttingDown = false;

const main = async () => {
    // Start the metrics server
    startMetricsServer();

    // get mongo client
    try {
        mongo = await mongoCollection();
    } catch (error) {
        console.error('Failed to connect to MongoDB:', error);
        process.exit(1);
    }

    // get redis client
    try {
        redisClient = await getRedisClient();
    } catch (error) {
        console.error('Failed to connect to Redis:', error);
        process.exit(1);
    }

    // get additional redis client for Subscribe mode,
    // during which other commands are unavailable
    try {
        redisSubscriber = await getRedisSubscriber();
    } catch (error) {
        console.error('Failed to get Redis subscriber:', error);
        process.exit(1);
    }

    // get throttler
    const throttler = await getThrottler();

    // subscribe for throttler updates
    await redisSubscribe({
        client: redisSubscriber,
        channel: REDIS_UPDATES_CHANNEL,
        message: REDIS_UPDATES_MESSAGE,
        callback: () => updateThrottler({redisClient, throttler})
    });

    // Power to the people!
    leader = new redisLeadership({redisClient, responsibility: 'general', ttl: RATE_LIMIT_LEADER_DURATION});
    await leader.scheduleLeaderAmbitions();

    // Let them fight!
    while (!await leader.isLeaderElected()) {
        console.log(`Hostname [${hostname()}] there can be only one!`)
        await new Promise(f => setTimeout(f, 1000));
    }

    // Prepare to admin
    if (await leader.isLeader()) {
        // combo
        await kafkaAdmin();
    }

    // Schedule throttler adjustments
    scheduleThrottlerAdjustments({redisClient, leader});

    // Prepare to reproduce
    await kafkaProducerConnect();

    // Combo - consume and reproduce
    await kafkaConsume({mongo, throttler, redisClient});
};

// The last will
async function gracefulShutdown() {
    if (isShuttingDown) {
        return;
    }
    isShuttingDown = true;

    // The living must not wait for the dead
    const shutdownTimeout = 5000;

    // Define a function that executes shutdown tasks sequentially
    const executeShutdownTasksSequentially = async () => {
        try {
            await mongoDisconnect();
        } catch (error) {
            console.error('Error during mongoDisconnect:', error);
        }

        try {
            await kafkaAdminDisconnect();
        } catch (error) {
            console.error('Error during kafkaAdminDisconnect:', error);
        }

        try {
            await kafkaProducerDisconnect();
        } catch (error) {
            console.error('Error during kafkaProducerDisconnect:', error);
        }

        try {
            await kafkaConsumerDisconnect();
        } catch (error) {
            console.error('Error during kafkaConsumerDisconnect:', error);
        }

        try {
            await unscheduleThrottlerAdjustments();
        } catch (error) {
            console.error('Error during unscheduleThrottlerAdjustments:', error);
        }

        try {
            await leader.relinquishLeadership();
        } catch (error) {
            console.error('Error during relinquishLeadership:', error);
        }

        try {
            await redisDisconnect();
        } catch (error) {
            console.error('Error during redisDisconnect:', error);
        }
    };

    // Use Promise.race to apply a timeout to the entire shutdown sequence
    await Promise.race([executeShutdownTasksSequentially(), new Promise((_, reject) => setTimeout(() => reject(new Error('Shutdown timeout')), shutdownTimeout)),])
        .then(() => {
            console.log('Graceful shutdown completed.');
            setTimeout(() => process.exit(0), 100);
        })
        .catch((error) => {
            console.error('Error during graceful shutdown:', error);
            setTimeout(() => process.exit(1), 100);
        });
}

// Prepare the last will
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('uncaughtException', async (error) => {
    console.error('Uncaught Exception:', error);
    await gracefulShutdown();
});
process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    await gracefulShutdown();
});

// Summon the Kraken!
main()
    .then(() => console.log("Crawler dispatched"))
    .catch(async (error) => {
        console.error('Error during crawler dispatch:', error);
        await gracefulShutdown();
    });