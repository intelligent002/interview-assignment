import Redis from 'ioredis';
import {hostname} from "node:os";
import {
    DATA_GOV_IL_DRIFT,
    RATE_LIMIT_ADJUST_COEFFICIENT,
    RATE_LIMIT_ADJUST_EVERY_SECONDS,
    RATE_LIMIT_ADJUST_MULTIPLIER,
    RATE_LIMIT_ADJUST_TREND,
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
const host = hostname();

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
            logger.debug(`Hostname [${host}] stinky peasants like me are disallowed get close to Rate Limit!`);
            return;
        }

        // proceed with rate limit adjustments (to be on the safe side, use init value as fallback when redis data unavailable)
        const currentLimit = parseInt(await redisClient.get(RATE_LIMIT_REDIS_LIMIT) || RATE_LIMIT_GLOBAL_INIT.toString());
        const successCount = parseInt(await redisClient.get(RATE_LIMIT_REDIS_SUCCESS) || '0');
        const failureCount = parseInt(await redisClient.get(RATE_LIMIT_REDIS_FAILURE) || '0');
        const trendOld = parseInt(await redisClient.get(RATE_LIMIT_ADJUST_TREND) || '1');
        let coefficient = parseInt(await redisClient.get(RATE_LIMIT_ADJUST_COEFFICIENT) || '1');
        const multiplier = RATE_LIMIT_ADJUST_MULTIPLIER

        // reset redis counters during the first 10 seconds of a minute
        //if (Date.now() % 60_000 < 10_000) {
        await redisClient.set(RATE_LIMIT_REDIS_SUCCESS, 0);
        await redisClient.set(RATE_LIMIT_REDIS_FAILURE, 0);
        //}

        // proceed only if there are some stats that are above the current limit,
        // otherwise we will continuously increment the rate during idle mode
        if (successCount + failureCount < currentLimit) {
            logger.warning("no jobs in queue or network throughput is low, will not modify rate.")
            return;
        }

        // increase rate if no rate limit failures
        // decrease if there are
        const trendNew: number = (failureCount === 0) ? 1 : -1;

        if (trendNew === trendOld) {
            // if trend is the same, increase coefficient
            coefficient = coefficient * multiplier;
        } else {
            // if trend changed reset the coefficient to 1
            coefficient = 1;
        }

        // adjust rate by vector
        let adjustedRate = currentLimit + trendNew * coefficient

        // Cap minimum
        if (adjustedRate < RATE_LIMIT_GLOBAL_MIN) {
            adjustedRate = RATE_LIMIT_GLOBAL_MIN;
            logger.warn('The calculated rate limit is at minimum, seems like the minimum need to be lowered')
        }
        // Cap maximum
        if (adjustedRate > RATE_LIMIT_GLOBAL_MAX) {
            adjustedRate = RATE_LIMIT_GLOBAL_MAX;
            logger.warn('The calculated rate limit is at maximum, seems like the maximum can to be enlarged')
        }
        // Persist data
        await redisClient.set(RATE_LIMIT_REDIS_LIMIT, adjustedRate);
        await redisClient.set(RATE_LIMIT_ADJUST_COEFFICIENT, coefficient);
        await redisClient.set(RATE_LIMIT_ADJUST_TREND, trendNew);

        // publish multicast signal
        await redisClient.publish(REDIS_UPDATES_CHANNEL, REDIS_UPDATES_MESSAGE);
        logger.info(`Hostname [${host}] has demanded a new Rate Limit of [${adjustedRate}] requests per minute.`);

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
    // Schedule the refreshes to round minute + data clock drift
    const millisecondsUntilNextMinute = 60_000 - (now % 60_000) + (DATA_GOV_IL_DRIFT * 1_000);

    // Schedule the first timeout
    setTimeout(() => {
        // Schedule the interval after the initial timeout runs
        intervalId = setInterval(() => autoAdjustThrottler({
            redisClient, leader
        }), RATE_LIMIT_ADJUST_EVERY_SECONDS * 1_000);
    }, millisecondsUntilNextMinute);

    logger.info(`Scheduled first rate adjustment in [${millisecondsUntilNextMinute}] ms from now to align with the start of the next minute and time drift.`);
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


