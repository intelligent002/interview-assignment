// redisConnectivity.test.ts

import Redis from 'ioredis';
import logger from '../logger';

import {
    getRedisClient,
    getRedisSubscriber,
    redisConnect,
    redisDisconnect,
    redisSubscribe,
    resetEncapsulatedForTests
} from './redisConnectivity';

jest.mock('ioredis');
jest.mock('../logger');

describe('Redis Connectivity Module', () => {
    let MockedRedis: jest.MockedClass<typeof Redis>;
    let mockedLogger: jest.Mocked<typeof logger>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Reset the module's internal variables to ensure test isolation
        resetEncapsulatedForTests();

        // Mock Redis constructor
        MockedRedis = Redis as jest.MockedClass<typeof Redis>;
        MockedRedis.mockImplementation(() => {
            const redisInstance = {
                on: jest.fn(),
                subscribe: jest.fn(),
                onMessage: jest.fn(),
                quit: jest.fn().mockResolvedValue('OK'),
            } as unknown as jest.Mocked<Redis>;

            // Simulate 'connect' event
            redisInstance.on.mockImplementation((event, callback) => {
                if (event === 'connect') {
                    callback();
                }
                return redisInstance;
            });

            return redisInstance;
        });

        // Mock logger
        mockedLogger = logger as jest.Mocked<typeof logger>;
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    test('should connect to Redis client and subscriber', async () => {
        await redisConnect();

        expect(MockedRedis).toHaveBeenCalledTimes(2);
        expect(mockedLogger.info).toHaveBeenCalledWith('Connected to Redis (client)');
        expect(mockedLogger.info).toHaveBeenCalledWith('Connected to Redis (subscriber)');
    });

    test('should get redisClient', async () => {
        const client = await getRedisClient();

        expect(client).toBeDefined();
        expect(MockedRedis).toHaveBeenCalledTimes(1);
        expect(mockedLogger.info).toHaveBeenCalledWith('Connected to Redis (client)');
    });

    test('should get redisClient from cache', async () => {
        let client1 = await getRedisClient();
        expect(client1).toBeDefined();
        expect(MockedRedis).toHaveBeenCalledTimes(1);
        expect(mockedLogger.info).toHaveBeenCalledWith('Connected to Redis (client)');
        MockedRedis.mockClear();

        let client2 = await getRedisClient();
        expect(client2).toBeDefined();
        expect(client2).toBe(client1);
        expect(MockedRedis).not.toHaveBeenCalled();
        expect(mockedLogger.info).toHaveBeenCalledWith('Connected to Redis (client)');
    });

    test('should get redisSubscriber', async () => {
        const subscriber = await getRedisSubscriber();

        expect(subscriber).toBeDefined();
        expect(MockedRedis).toHaveBeenCalledTimes(1);
        expect(mockedLogger.info).toHaveBeenCalledWith('Connected to Redis (subscriber)');
    });

    test('should get redisSubscriber from cache', async () => {
        let subscriber1 = await getRedisSubscriber();
        expect(subscriber1).toBeDefined();
        expect(MockedRedis).toHaveBeenCalledTimes(1);
        expect(mockedLogger.info).toHaveBeenCalledWith('Connected to Redis (subscriber)');
        MockedRedis.mockClear();

        let subscriber2 = await getRedisSubscriber();
        expect(subscriber2).toBeDefined();
        expect(subscriber2).toBe(subscriber1);
        expect(MockedRedis).not.toHaveBeenCalled();
        expect(mockedLogger.info).toHaveBeenCalledWith('Connected to Redis (subscriber)');
    });

    test('should handle Redis connection error', async () => {
        const error = new Error('Connection error');

        // Mock Redis constructor to simulate 'error' event for this test
        MockedRedis.mockImplementationOnce(() => {
            const redisInstance = {
                on: jest.fn(),
                quit: jest.fn().mockResolvedValue('OK'),
            } as unknown as jest.Mocked<Redis>;

            redisInstance.on.mockImplementation((event, callback) => {
                if (event === 'error') {
                    callback(error);
                }
                return redisInstance;
            });

            return redisInstance;
        });

        await expect(getRedisClient()).rejects.toThrow('Connection error');
        expect(mockedLogger.error).toHaveBeenCalledWith('Redis connection error (client):', error);
    });

    test('should subscribe to Redis channel and handle messages', async () => {
        // Mock client
        const client = {
            subscribe: jest.fn(
                (
                    channel: string,
                    callback: (err: Error | null, count: number) => void
                ): Promise<void> => {
                    callback(null, 1); // Simulate successful subscription
                    return Promise.resolve();
                }
            ),
            on: jest.fn(),
        } as unknown as jest.Mocked<Redis>;

        const callback = jest.fn();

        await redisSubscribe({
            client,
            channel: 'test-channel',
            message: 'test-message',
            callback,
        });

        expect(client.subscribe).toHaveBeenCalledWith('test-channel', expect.any(Function));
        expect(mockedLogger.info).toHaveBeenCalledWith('Redis subscribed to [1] channel(s).');

        // Simulate receiving the correct message
        const messageHandler = client.on.mock.calls.find((call: any[]) => call[0] === 'message')![1];
        messageHandler('test-channel', 'test-message');
        expect(callback).toHaveBeenCalled();

        // Simulate receiving an unexpected message
        messageHandler('test-channel', 'unexpected-message');
        expect(mockedLogger.error).toHaveBeenCalledWith(
            'Redis subscription received unexpected message [unexpected-message] via channel [test-channel]'
        );
    });

    test('should handle Redis subscription error', async () => {
        // Mock client
        const client = {
            subscribe: jest.fn((channel, callback) => {
                callback(new Error('Subscription error'), 0);
                return Promise.resolve();
            }),
            on: jest.fn(),
        } as unknown as jest.Mocked<Redis>;

        const callback = jest.fn();

        await redisSubscribe({
            client,
            channel: 'test-channel',
            message: 'test-message',
            callback,
        });

        expect(mockedLogger.error).toHaveBeenCalledWith(
            'Redis subscription to channel [test-channel] failed:',
            expect.any(Error)
        );
    });

    test('should disconnect from Redis', async () => {
        // Set up clients
        const clientInstance = await getRedisClient();
        const subscriberInstance = await getRedisSubscriber();

        clientInstance.quit = jest.fn().mockResolvedValue('OK');
        subscriberInstance.quit = jest.fn().mockResolvedValue('OK');

        await redisDisconnect();

        expect(clientInstance.quit).toHaveBeenCalled();
        expect(subscriberInstance.quit).toHaveBeenCalled();
        expect(mockedLogger.info).toHaveBeenCalledWith('Redis disconnected.');
    });

    test('should handle error during Redis disconnect', async () => {
        const error = new Error('Disconnect error');

        const clientInstance = await getRedisClient();
        clientInstance.quit = jest.fn().mockRejectedValue(error);

        await redisDisconnect();

        expect(mockedLogger.error).toHaveBeenCalledWith('Error disconnecting from Redis:', error);
        expect(mockedLogger.info).toHaveBeenCalledWith('Redis disconnected.');
    });
});