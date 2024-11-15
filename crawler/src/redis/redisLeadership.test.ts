import Redis from 'ioredis';
import logger from '../logger';
import {redisLeadership} from './redisLeadership';

jest.mock('ioredis');
jest.mock('../logger');

describe('redisLeadership Class', () => {
    let redisClientMock: jest.Mocked<Redis>;
    let leader: redisLeadership;
    let mockedLogger: jest.Mocked<typeof logger>;

    // Store the actual hostname
    const actualHostname = require('os').hostname();

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();

        // Mock Redis client with necessary methods
        redisClientMock = {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            pexpire: jest.fn(),
        } as unknown as jest.Mocked<Redis>;

        // Mock logger
        mockedLogger = logger as jest.Mocked<typeof logger>;
        mockedLogger.info = jest.fn();
        mockedLogger.debug = jest.fn();
        mockedLogger.warn = jest.fn();
        mockedLogger.error = jest.fn();

        // Initialize the redisLeadership instance
        leader = new redisLeadership({
            redisClient: redisClientMock,
            responsibility: 'test-responsibility',
            ttl: 10000, // 10 seconds
        });
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
        jest.resetAllMocks();
    });

    test('should initialize with correct instanceId', () => {
        expect(leader).toBeDefined();
        expect(leader['instanceId']).toBe(actualHostname);
    });

    test('should check if instance is leader', async () => {
        redisClientMock.get = jest.fn().mockResolvedValue(actualHostname);

        const isLeader = await leader.isLeader();

        expect(redisClientMock.get).toHaveBeenCalledWith('test-responsibility');
        expect(isLeader).toBe(true);
    });

    test('should check if leader is elected', async () => {
        redisClientMock.get = jest.fn().mockResolvedValue('some-leader');

        const isLeaderElected = await leader.isLeaderElected();

        expect(redisClientMock.get).toHaveBeenCalledWith('test-responsibility');
        expect(isLeaderElected).toBe(true);
    });

    test('should claim leadership when not leader', async () => {
        redisClientMock.get = jest.fn().mockResolvedValueOnce(null); // isLeader
        redisClientMock.set = jest.fn().mockResolvedValue('OK');

        leader['scheduleRenewal'] = jest.fn();

        const result = await leader.claimLeadership();

        expect(redisClientMock.get).toHaveBeenCalledWith('test-responsibility');
        expect(redisClientMock.set).toHaveBeenCalledWith(
            'test-responsibility',
            actualHostname,
            'PX',
            10000,
            'NX'
        );
        expect(mockedLogger.info).toHaveBeenCalledWith(`Hostname [${actualHostname}] is the horde leader now!`);
        expect(leader['scheduleRenewal']).toHaveBeenCalled();
        expect(result).toBe(true);
    });

    test('should not claim leadership if already leader', async () => {
        redisClientMock.get = jest.fn().mockResolvedValue(actualHostname);

        const result = await leader.claimLeadership();

        expect(redisClientMock.get).toHaveBeenCalledWith('test-responsibility');
        expect(redisClientMock.set).not.toHaveBeenCalled();
        expect(result).toBe(true);
    });

    test('should fail to claim leadership if another leader exists', async () => {
        redisClientMock.get = jest.fn().mockResolvedValue('another-hostname');
        redisClientMock.set = jest.fn().mockResolvedValue(null); // set returns null if not successful

        const result = await leader.claimLeadership();

        expect(redisClientMock.get).toHaveBeenCalledWith('test-responsibility');
        expect(redisClientMock.set).toHaveBeenCalledWith(
            'test-responsibility',
            actualHostname,
            'PX',
            10000,
            'NX'
        );
        expect(mockedLogger.debug).toHaveBeenCalledWith(
            `Hostname [${actualHostname}] is just a sidekick, dreaming of the Big Chair!`
        );
        expect(result).toBe(false);
    });

    test('should schedule leader ambitions', async () => {
        leader.claimLeadership = jest.fn();
        await leader.scheduleLeaderAmbitions();

        expect(leader.claimLeadership).toHaveBeenCalled();

        // Fast-forward time to simulate interval execution
        jest.advanceTimersByTime(10000); // ttl

        expect(leader.claimLeadership).toHaveBeenCalledTimes(2); // Initial call + one interval
    });

    test('should schedule renewal when leader', async () => {
        // Initialize spies and store them in variables
        const setIntervalSpy = jest.spyOn(global, 'setInterval');
        const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

        // Mock `scheduleRenewal` to set `renewInterval`
        leader['scheduleRenewal']();

        // should not be called as renewInterval was not set
        expect(clearIntervalSpy).not.toHaveBeenCalled();
        expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000); // ttl / 2

        // We will test it again now
        setIntervalSpy.mockClear();

        // Mock `scheduleRenewal` to set `renewInterval`
        leader['scheduleRenewal']();

        // and now it should be called as renewInterval was set
        expect(clearIntervalSpy).toHaveBeenCalled();
        expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000); // ttl / 2

        // Simulate the interval function execution
        const renewalFunction = setIntervalSpy.mock.calls[0][0] as () => Promise<void>;

        // Mock isLeader to return true
        leader.isLeader = jest.fn().mockResolvedValue(true);
        redisClientMock.pexpire = jest.fn().mockResolvedValue(1);

        // Execute the renewal function and wait for it to complete
        await renewalFunction();

        expect(leader.isLeader).toHaveBeenCalled();
        expect(redisClientMock.pexpire).toHaveBeenCalledWith('test-responsibility', 10000);
        expect(mockedLogger.info).toHaveBeenCalledWith(`Hostname [${actualHostname}] had its leadership extended`);
    });

    test('should relinquish leadership', async () => {
        leader.isLeader = jest.fn().mockResolvedValue(true);
        redisClientMock.del = jest.fn().mockResolvedValue(true);
        const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

        // Mock `scheduleRenewal` to set `renewInterval`
        leader['renewInterval'] = setInterval(jest.fn(), 1000);

        // Mock `redisClient.set` to resolve successfully
        redisClientMock.set = jest.fn().mockResolvedValue('OK');

        // issue test function
        await leader.relinquishLeadership();

        expect(leader.isLeader).toHaveBeenCalled();
        expect(redisClientMock.del).toHaveBeenCalledWith('test-responsibility');
        expect(clearIntervalSpy).toHaveBeenCalled();
        expect(leader['renewInterval']).toBeNull();
        expect(mockedLogger.info).toHaveBeenCalledWith(`Hostname [${actualHostname}] has relinquished its leadership`);
    });

    test('should handle losing leadership during renewal', async () => {
        // Initialize spies and store them in variables
        const setIntervalSpy = jest.spyOn(global, 'setInterval');
        const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

        leader['scheduleRenewal']();

        // Simulate the interval function execution
        const renewalFunction = setIntervalSpy.mock.calls[0][0] as () => Promise<void>;

        // Mock isLeader to return false
        leader.isLeader = jest.fn().mockResolvedValue(false);

        // Execute the renewal function and wait for it to complete
        await renewalFunction();

        expect(leader.isLeader).toHaveBeenCalled();
        expect(clearIntervalSpy).toHaveBeenCalled();
        expect(leader['renewInterval']).toBeNull();
        expect(mockedLogger.warn).toHaveBeenCalledWith(`Hostname [${actualHostname}] has lost its leadership`);
    });

    test('should handle errors in claimLeadership', async () => {
        const error = new Error('Redis error');
        redisClientMock.get = jest.fn().mockRejectedValue(error);

        await expect(leader.claimLeadership()).rejects.toThrow('Redis error');
    });

    test('should handle errors in isLeader', async () => {
        const error = new Error('Redis error');
        redisClientMock.get = jest.fn().mockRejectedValue(error);

        await expect(leader.isLeader()).rejects.toThrow('Redis error');
    });
});
