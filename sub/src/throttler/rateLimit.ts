import {RATE_LIMIT_GLOBAL_MIN, RATE_LIMIT_REDIS_LIMIT} from "../config";
import Bottleneck from 'bottleneck';
import Redis from "ioredis";
import {hostname} from "node:os";

// Main item
let limiter: Bottleneck;

export async function getThrottler() {

    // return singleton
    if (limiter) {
        return limiter;
    }

    // create one with default settings
    const rateLimit = parseInt(RATE_LIMIT_GLOBAL_MIN.toString());
    const minTime = calculateDelayFromRate(rateLimit);
    limiter = new Bottleneck({
        maxConcurrent: 1,
        minTime,
    })
    console.log(`Hostname [${hostname()}] configured its Rate Limit with [${rateLimit}] requests per minute, which is [${minTime}] ms.`);

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
        minTime: rateLimit
    });
    console.log(`Hostname [${hostname()}] updated its Rate Limit with [${rateLimit}] requests per minute, which is [${minTime}] ms.`);
}


// what is the delay between requests, if the rate is 500 requests per minute?
export function calculateDelayFromRate(rate: number) {
    return Math.round(60_000 / rate);
}