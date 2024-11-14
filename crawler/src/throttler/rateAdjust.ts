import Redis from 'ioredis';
import os from 'os';
import {
    RATE_LIMIT_ADJUST_EVERY_SECONDS,
    RATE_LIMIT_GLOBAL_INIT,
    RATE_LIMIT_GLOBAL_MAX,
    RATE_LIMIT_GLOBAL_MIN,
    RATE_LIMIT_REDIS_FAILURE,
    RATE_LIMIT_REDIS_LIMIT,
    RATE_LIMIT_REDIS_SUCCESS,
    REDIS_UPDATES_CHANNEL,
    REDIS_UPDATES_MESSAGE
} from "../config";
import {redisLeadership} from "../redis/redisLeadership";
import logger from "../logger";

// Other peripherals ...
const hostname = os.hostname();

// let's define those for further cancellation
let intervalId: NodeJS.Timeout | null;

export async function registerRateLimitSuccess(redisClient: Redis) {
    await redisClient.incr(RATE_LIMIT_REDIS_SUCCESS)
}

export async function registerRateLimitFailure(redisClient: Redis) {
    await redisClient.incr(RATE_LIMIT_REDIS_FAILURE)
}

async function autoAdjustThrottler(
    {
        redisClient, leader
    }: {
        redisClient: Redis, leader: redisLeadership
    }) {
    try {
        if (!await leader.isLeader()) {
            logger.debug(`Hostname [${hostname}] stinky peasants like me are disallowed get close to Rate Limit!`);
            return;
        }

        // proceed with rate limit adjustments (to be on the safe side, use minimal value as fallback when redis data unavailable)
        const currentLimit = parseInt(await redisClient.get(RATE_LIMIT_REDIS_LIMIT) || RATE_LIMIT_GLOBAL_INIT.toString());
        const successCount = parseInt(await redisClient.get(RATE_LIMIT_REDIS_SUCCESS) || '0');
        const failureCount = parseInt(await redisClient.get(RATE_LIMIT_REDIS_FAILURE) || '0');

        // reset counters during the first 10 seconds of a minute
        //if (Date.now() % 60_000 < 10_000) {
        await redisClient.set(RATE_LIMIT_REDIS_SUCCESS, 0);
        await redisClient.set(RATE_LIMIT_REDIS_FAILURE, 0);
        //}

        // proceed only if there are some stats, otherwise we will continuously increment the rate during idle mode
        if (successCount + failureCount > 0) {
            const adjustedRate = failureCount > 0
                ? Math.max(currentLimit - 3, RATE_LIMIT_GLOBAL_MIN)
                : Math.min(currentLimit + 1, RATE_LIMIT_GLOBAL_MAX);
            if (adjustedRate === RATE_LIMIT_GLOBAL_MIN) {
                logger.warning('The calculated rate limit is equal to minimum, seems like the minimum need to be lowered')
            }
            if (adjustedRate === RATE_LIMIT_GLOBAL_MAX) {
                logger.warning('The calculated rate limit is equal to maximum, seems like the maximum can to be enlarged')
            }
            await redisClient.set(RATE_LIMIT_REDIS_LIMIT, adjustedRate);
            await redisClient.publish(REDIS_UPDATES_CHANNEL, REDIS_UPDATES_MESSAGE);
            logger.info(`Hostname [${hostname}] has demanded a new Rate Limit of [${adjustedRate}] requests per minute.`);
        }
    } catch (error) {
        const err = error as Error;
        logger.error('Error adjusting global rate limit:', err);
    }
}

// configure periodical adjustments from the round minute + delta and on every few seconds
export function scheduleThrottlerAdjustments(
    {
        redisClient, leader
    }: {
        redisClient: Redis, leader: redisLeadership
    }) {
    const now = Date.now();
    const millisecondsUntilNextMinute = 60_000 - (now % 60_000);

    // Schedule the first timeout
    setTimeout(() => {
        // Schedule the interval after the initial timeout runs
        intervalId = setInterval(() => autoAdjustThrottler({
            redisClient, leader
        }), RATE_LIMIT_ADJUST_EVERY_SECONDS * 1_000);
    }, millisecondsUntilNextMinute);

    logger.info(`Scheduled first rate adjustment in [${millisecondsUntilNextMinute}] ms from now to align with the start of the next minute.`);
}

export async function unscheduleThrottlerAdjustments() {
    // wipe renew interval
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
    logger.info('Throttler adjustments unscheduled.');
    return true;
}


