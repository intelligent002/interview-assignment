jest.mock('../logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
}));

import Redis from 'ioredis';
import os from 'os';
import logger from '../logger';
import { redisLeadership } from './redisLeadership';

jest.mock('ioredis');
jest.mock('os');
jest.mock('../logger');

describe('redisLeadership', () => {
    let redisClientMock: jest.Mocked<Redis>;
    let leader: redisLeadership;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();

        // Mock Redis client
        redisClientMock = new Redis() as jest.Mocked<Redis>;

        // Mock os.hostname()
        (os.hostname as jest.Mock).mockReturnValue('test-hostname');

        // Instantiate the leader class
        leader = new redisLeadership({
            redisClient: redisClientMock,
            responsibility: 'test-responsibility',
            ttl: 1000,
        });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('should create an instance', () => {
        expect(leader).toBeDefined();
        expect(leader).toBeInstanceOf(redisLeadership);
    });

    test('should correctly check if isLeader when leader', async () => {
        redisClientMock.get = jest.fn().mockResolvedValue('test-hostname');
        const result = await leader.isLeader();
        expect(result).toBe(true);
        expect(redisClientMock.get).toHaveBeenCalledWith('test-responsibility');
    });

    test('should correctly check if isLeader when not leader', async () => {
        redisClientMock.get = jest.fn().mockResolvedValue('other-hostname');
        const result = await leader.isLeader();
        expect(result).toBe(false);
        expect(redisClientMock.get).toHaveBeenCalledWith('test-responsibility');
    });

    test('should correctly check if leader is elected', async () => {
        redisClientMock.get = jest.fn().mockResolvedValue('some-hostname');
        const result = await leader.isLeaderElected();
        expect(result).toBe(true);
        expect(redisClientMock.get).toHaveBeenCalledWith('test-responsibility');
    });

    test('should claim leadership successfully', async () => {
        redisClientMock.get = jest.fn().mockResolvedValue(null);
        redisClientMock.set = jest.fn().mockResolvedValue('OK');
        const scheduleRenewalSpy = jest.spyOn(leader as any, 'scheduleRenewal');

        const result = await leader.claimLeadership();
        expect(result).toBe(true);
        expect(redisClientMock.get).toHaveBeenCalledWith('test-responsibility');
        expect(redisClientMock.set).toHaveBeenCalledWith(
            'test-responsibility',
            'test-hostname',
            'PX',
            1000,
            'NX'
        );
        expect(logger.info).toHaveBeenCalledWith(
            'Hostname [test-hostname] is the horde leader now!'
        );
        expect(scheduleRenewalSpy).toHaveBeenCalled();

        scheduleRenewalSpy.mockRestore();
    });

    test('should not claim leadership if already leader', async () => {
        redisClientMock.get = jest.fn().mockResolvedValue('test-hostname');
        const result = await leader.claimLeadership();
        expect(result).toBe(true);
        expect(redisClientMock.get).toHaveBeenCalledWith('test-responsibility');
        expect(redisClientMock.set).not.toHaveBeenCalled();
    });

    test('should fail to claim leadership if another leader exists', async () => {
        redisClientMock.get = jest.fn().mockResolvedValue('other-hostname');
        redisClientMock.set = jest.fn().mockResolvedValue(null);
        const result = await leader.claimLeadership();
        expect(result).toBe(false);
        expect(redisClientMock.get).toHaveBeenCalledWith('test-responsibility');
        expect(redisClientMock.set).toHaveBeenCalledWith(
            'test-responsibility',
            'test-hostname',
            'PX',
            1000,
            'NX'
        );
        expect(logger.debug).toHaveBeenCalledWith(
            'Hostname [test-hostname] is just a sidekick, dreaming of the Big Chair!'
        );
    });

    test('should schedule leadership ambitions', async () => {
        const claimLeadershipSpy = jest.spyOn(leader, 'claimLeadership').mockResolvedValue(true);

        await leader.scheduleLeaderAmbitions();

        expect(claimLeadershipSpy).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(1000);

        expect(claimLeadershipSpy).toHaveBeenCalledTimes(2);

        jest.advanceTimersByTime(2000);

        expect(claimLeadershipSpy).toHaveBeenCalledTimes(4);

        claimLeadershipSpy.mockRestore();
    });

    test('should renew leadership when still leader', () => {
        const isLeaderSpy = jest.spyOn(leader, 'isLeader').mockResolvedValue(true);
        const pexpireSpy = jest
            .spyOn(redisClientMock, 'pexpire')
            .mockResolvedValue(1);
        (leader as any).scheduleRenewal();

        jest.advanceTimersByTime(500); // Half of TTL

        expect(isLeaderSpy).toHaveBeenCalled();
        expect(redisClientMock.pexpire).toHaveBeenCalledWith('test-responsibility', 1000);
        expect(logger.info).toHaveBeenCalledWith(
            'Hostname [test-hostname] had its leadership extended'
        );

        isLeaderSpy.mockRestore();
        pexpireSpy.mockRestore();
    });

    test('should handle loss of leadership during renewal', () => {
        const isLeaderSpy = jest.spyOn(leader, 'isLeader').mockResolvedValue(false);
        const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
        (leader as any).scheduleRenewal();

        jest.advanceTimersByTime(500); // Half of TTL

        expect(isLeaderSpy).toHaveBeenCalled();
        expect(redisClientMock.pexpire).not.toHaveBeenCalled();
        expect(clearIntervalSpy).toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith(
            'Hostname [test-hostname] has lost its leadership'
        );

        isLeaderSpy.mockRestore();
        clearIntervalSpy.mockRestore();
    });

    test('should relinquish leadership when leader', async () => {
        redisClientMock.get = jest.fn().mockResolvedValue('test-hostname');
        redisClientMock.del = jest.fn().mockResolvedValue(1);
        const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

        await leader.relinquishLeadership();

        expect(redisClientMock.get).toHaveBeenCalledWith('test-responsibility');
        expect(redisClientMock.del).toHaveBeenCalledWith('test-responsibility');
        expect(clearIntervalSpy).toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith(
            'Hostname [test-hostname] has relinquished its leadership'
        );

        clearIntervalSpy.mockRestore();
    });

    test('should handle relinquishLeadership when not leader', async () => {
        redisClientMock.get = jest.fn().mockResolvedValue('other-hostname');
        const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

        await leader.relinquishLeadership();

        expect(redisClientMock.get).toHaveBeenCalledWith('test-responsibility');
        expect(redisClientMock.del).not.toHaveBeenCalled();
        expect(clearIntervalSpy).toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith(
            'Hostname [test-hostname] has relinquished its leadership'
        );

        clearIntervalSpy.mockRestore();
    });
});
