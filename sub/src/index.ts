import {mongoConnection, mongoDisconnect} from './mongoClient';
import {consumeFromKafka} from './kafka/kafkaConsumer';
import {startMetricsServer} from './metrics';
import {kafkaProducerConnect, kafkaProducerDisconnect} from "./kafka/kafkaProducer";
import {getThrottler, updateThrottler} from "./throttler/rateLimit";
import {getRedisClient, getRedisSubscriber, redisDisconnect, redisSubscribe} from "./redis/redisConnectivity";
import {RATE_LIMIT_LEADER_DURATION, REDIS_UPDATES_CHANNEL, REDIS_UPDATES_MESSAGE} from "./config";
import {scheduleThrottlerAdjustments, unscheduleThrottlerAdjustments} from "./throttler/rateAdjust";
import {redisLeadership} from "./redis/redisLeadership";

const main = async () => {
    // Start the metrics server
    startMetricsServer();

    // get mongo
    const mongo = await mongoConnection();

    // maybe ...
    // await redisConnect();

    // get redis client
    const redisClient = await getRedisClient();

    // get additional redis client for Subscribe mode,
    // during which other commands are unavailable
    const redisSubscriber = await getRedisSubscriber();

    // subscribe for throttler updates
    await redisSubscribe({
        client: redisSubscriber,
        channel: REDIS_UPDATES_CHANNEL,
        message: REDIS_UPDATES_MESSAGE,
        callback: () => updateThrottler({redisClient, throttler})
    });

    const leader = new redisLeadership({redisClient, responsibility: 'general', ttl: RATE_LIMIT_LEADER_DURATION});
    await leader.scheduleLeaderAmbitions();

    // get throttler
    const throttler = await getThrottler();

    // schedule throttler adjustments
    scheduleThrottlerAdjustments({redisClient, leader});

    // prepare to reproduce
    await kafkaProducerConnect();

    // consume and reproduce
    await consumeFromKafka({mongo, throttler, redisClient});

    process.on('SIGINT', async () => {
        await mongoDisconnect();
        await kafkaProducerDisconnect();
        unscheduleThrottlerAdjustments();
        await leader.relinquishLeadership();
        await redisDisconnect();
        process.exit();
    });
};

main()
    .then(() => console.log("done the main"))
    .catch((error) => console.log(error));
