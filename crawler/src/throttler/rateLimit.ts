import {RATE_LIMIT_GLOBAL_INIT, RATE_LIMIT_GLOBAL_MIN, RATE_LIMIT_REDIS_LIMIT} from "../config";
import Bottleneck from 'bottleneck';
import Redis from "ioredis";
import {hostname} from "node:os";
import {metricRateLimit} from "../metrics";
import logger from "../logger";

// Main item
let limiter: Bottleneck;

export async function getThrottler() {

    // return singleton
    if (limiter) {
        return limiter;
    }

    // create one with default settings
    const rateLimit = parseInt(RATE_LIMIT_GLOBAL_INIT.toString());
    const minTime = calculateDelayFromRate(rateLimit);
    limiter = new Bottleneck({
        maxConcurrent: 1,
        minTime,
    })
    metricRateLimit.set({host: hostname()}, rateLimit);
    logger.debug(`Hostname [${hostname()}] configured its Rate Limit with [${rateLimit}] requests per minute, which is [${minTime}] ms.`);

    // return singleton
    return limiter;
}

export async function updateThrottler(
    {
        redisClient,
        throttler
    }: {
        redisClient: Redis,
        throttler: Bottleneck
    }) {

    const rateLimit = parseInt(await redisClient.get(RATE_LIMIT_REDIS_LIMIT) || RATE_LIMIT_GLOBAL_MIN.toString());
    const minTime = calculateDelayFromRate(rateLimit);
    throttler.updateSettings({
        maxConcurrent: 1,
        minTime: minTime
    });
    metricRateLimit.set({host: hostname()}, rateLimit);
    logger.debug(`Hostname [${hostname()}] updated its Rate Limit with [${rateLimit}] requests per minute, which is [${minTime}] ms.`);
}


// what is the delay between requests, if the rate is 500 requests per minute?
export function calculateDelayFromRate(rate: number): number {
    return Math.round(60_000 / rate);
}