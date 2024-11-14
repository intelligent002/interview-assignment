import Redis from "ioredis";
import {REDIS_HOST, REDIS_PASS, REDIS_PORT, REDIS_USER} from "../config";

let client: Redis | null = null;
let subscriber: Redis | null = null;

// combo method
export async function redisConnect(){
    await getRedisClient();
    await getRedisSubscriber();
}

// Exported function to get client connection
export async function getRedisClient(): Promise<Redis> {
    return getConnection('client');
}

// Exported function to get subscriber connection
export async function getRedisSubscriber(): Promise<Redis> {
    return getConnection('subscriber');
}

// internal function to get connections
async function getConnection(type: 'client' | 'subscriber'): Promise<Redis> {
    if (type === 'client' && client) {
        return client;
    }
    if (type === 'subscriber' && subscriber) {
        return subscriber;
    }

    // Create Redis connection based on the type
    const redisConnection = new Redis({
        host: REDIS_HOST,
        port: REDIS_PORT,
        username: REDIS_USER,
        password: REDIS_PASS,
    });

    // Return a promise that resolves with the Redis connection
    return new Promise<Redis>((resolve, reject) => {
        redisConnection.on('connect', () => {
            console.log(`Connected to Redis (${type})`);
            if (type === 'client') {
                client = redisConnection;
            } else {
                subscriber = redisConnection;
            }
            resolve(redisConnection);
        });
        redisConnection.on('error', (err) => {
            console.error(`Redis connection error (${type}):`, err);
            reject(err);
        });
    });
}

export async function redisSubscribe(
    {
        client,
        channel,
        message,
        callback
    }: {
        client: Redis,
        channel: string,
        message: string,
        callback: () => void
    }
): Promise<void> {
    // Subscribe to some channel
    client.subscribe(channel, (err, count) => {
        if (err) {
            console.error(`Redis subscription to channel [${channel}] failed:`, err);
        } else {
            console.log(`Redis subscribed to [${count}] channel(s).`);
        }
    });

    // Issue callback once command received
    client.on('message', (receivedChannel, ReceivedMessage) => {
        if (receivedChannel === channel && ReceivedMessage === message) {
            callback();
        } else console.error(`Redis subscription received unexpected message [${ReceivedMessage}] via channel [${receivedChannel}]`)
    });
}

export async function redisDisconnect() {
    try {
        if (client)
            await client.quit();
        if (subscriber)
            await subscriber.quit();
    } catch (error) {
        console.error('Error disconnecting from Redis:', error);
    }
    console.log('Redis disconnected.');
}