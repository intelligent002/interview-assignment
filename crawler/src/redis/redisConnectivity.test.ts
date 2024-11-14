import Redis from 'ioredis';
import logger from '../logger';
import {
    redisConnect,
    getRedisClient,
    getRedisSubscriber,
    redisSubscribe,
    redisDisconnect,
} from './redisConnectivity';

jest.mock('ioredis');
jest.mock('../logger');

describe('Redis Connectivity Module', () => {
    let MockedRedis: jest.MockedClass<typeof Redis>;
    let redisClientMock: jest.Mocked<Redis>;
    let redisSubscriberMock: jest.Mocked<Redis>;
    let mockedLogger: jest.Mocked<typeof logger>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock Redis constructor
        MockedRedis = Redis as jest.MockedClass<typeof Redis>;
        MockedRedis.mockImplementation(() => {
            return {
                on: jest.fn(),
                subscribe: jest.fn(),
                onMessage: jest.fn(),
                quit: jest.fn().mockResolvedValue('OK'),
            } as any;
        });

        // Mock instances
        redisClientMock = new Redis() as jest.Mocked<Redis>;
        redisSubscriberMock = new Redis() as jest.Mocked<Redis>;

        // Mock logger
        mockedLogger = logger as jest.Mocked<typeof logger>;
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    test('should connect to Redis client and subscriber', async () => {
        // Mock the 'on' method to simulate 'connect' event
        redisClientMock.on.mockImplementation((event, callback) => {
            if (event === 'connect') {
                callback();
            }
            return redisClientMock;
        });

        redisSubscriberMock.on.mockImplementation((event, callback) => {
            if (event === 'connect') {
                callback();
            }
            return redisSubscriberMock;
        });

        await redisConnect();

        expect(MockedRedis).toHaveBeenCalledTimes(2);
        expect(mockedLogger.info).toHaveBeenCalledWith('Connected to Redis (client)');
        expect(mockedLogger.info).toHaveBeenCalledWith('Connected to Redis (subscriber)');
    });

    test('should get Redis client', async () => {
        redisClientMock.on.mockImplementation((event, callback) => {
            if (event === 'connect') {
                callback();
            }
            return redisClientMock;
        });

        const client = await getRedisClient();

        expect(client).toBeDefined();
        expect(MockedRedis).toHaveBeenCalledTimes(1);
        expect(mockedLogger.info).toHaveBeenCalledWith('Connected to Redis (client)');
    });

    test('should get Redis subscriber', async () => {
        redisSubscriberMock.on.mockImplementation((event, callback) => {
            if (event === 'connect') {
                callback();
            }
            return redisSubscriberMock;
        });

        const subscriber = await getRedisSubscriber();

        expect(subscriber).toBeDefined();
        expect(MockedRedis).toHaveBeenCalledTimes(1);
        expect(mockedLogger.info).toHaveBeenCalledWith('Connected to Redis (subscriber)');
    });

    test('should handle Redis connection error', async () => {
        const error = new Error('Connection error');
        redisClientMock.on.mockImplementation((event, callback) => {
            if (event === 'error') {
                callback(error);
            }
            return redisClientMock;
        });

        await expect(getRedisClient()).rejects.toThrow('Connection error');
        expect(mockedLogger.error).toHaveBeenCalledWith('Redis connection error (client):', error);
    });

    test('should subscribe to Redis channel and handle messages', async () => {
        // Mock client
        const client = {
            subscribe: jest.fn((channel: string, callback: (err: Error | null, count: number) => void) => {
                callback(null, 1); // Simulate successful subscription
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
            }),
            on: jest.fn(),
        } as unknown as Redis;

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
        // Mock clients
        redisClientMock.quit.mockResolvedValue('OK');
        redisSubscriberMock.quit.mockResolvedValue('OK');

        // Set the clients in the module's scope
        (await getRedisClient()) as any;
        (await getRedisSubscriber()) as any;

        await redisDisconnect();

        expect(redisClientMock.quit).toHaveBeenCalled();
        expect(redisSubscriberMock.quit).toHaveBeenCalled();
        expect(mockedLogger.info).toHaveBeenCalledWith('Redis disconnected.');
    });

    test('should handle error during Redis disconnect', async () => {
        const error = new Error('Disconnect error');
        redisClientMock.quit.mockRejectedValue(error);

        // Set the clients in the module's scope
        (await getRedisClient()) as any;

        await redisDisconnect();

        expect(mockedLogger.error).toHaveBeenCalledWith('Error disconnecting from Redis:', error);
        expect(mockedLogger.info).toHaveBeenCalledWith('Redis disconnected.');
    });
});
