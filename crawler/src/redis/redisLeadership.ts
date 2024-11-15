import Redis from 'ioredis';
import {hostname} from "os";
import logger from "../logger";

export class redisLeadership {

    private readonly redisClient: Redis;
    private readonly responsibility: string;
    private readonly ttl: number;
    private readonly instanceId: string;
    private renewInterval: NodeJS.Timeout | null = null;

    constructor(
        {
            redisClient,
            responsibility,
            ttl
        }: {
            redisClient: Redis,
            responsibility: string,
            ttl: number
        }) {
        this.redisClient = redisClient;
        this.responsibility = responsibility;
        this.ttl = ttl;
        this.instanceId = hostname(); // Unique identifier for this instance
    }

    async isLeader(): Promise<boolean> {
        return (await this.redisClient.get(this.responsibility) === this.instanceId);
    }

    async isLeaderElected(): Promise<boolean> {
        return (await this.redisClient.get(this.responsibility) !== null);
    }

    async scheduleLeaderAmbitions(): Promise<void> {
        await this.claimLeadership();
        setInterval(async () => {
            await this.claimLeadership();
        }, this.ttl);
    }

    async claimLeadership(): Promise<boolean> {
        if (await this.isLeader()) {
            return true;
        }
        const result = await this.redisClient.set(this.responsibility, this.instanceId, 'PX', this.ttl, 'NX');
        if (result === 'OK') {
            logger.info(`Hostname [${this.instanceId}] is the horde leader now!`);
            this.scheduleRenewal();
            return true;
        }
        logger.debug(`Hostname [${this.instanceId}] is just a sidekick, dreaming of the Big Chair!`);
        return false;
    }

    async relinquishLeadership(): Promise<void> {
        // Wipe leadership mention in redis
        if (this.redisClient) {
            if (await this.isLeader()) {
                await this.redisClient.del(this.responsibility);
            }
        }
        // wipe renew interval
        if (this.renewInterval !== null) {
            clearInterval(this.renewInterval);
            this.renewInterval = null;
        }
        logger.info(`Hostname [${this.instanceId}] has relinquished its leadership`);
    }

    private scheduleRenewal(): void {
        // Prevent duplication
        if (this.renewInterval) {
            clearInterval(this.renewInterval!);
            this.renewInterval = null;
        }

        // Schedule renewal at half the TTL to ensure leadership retention
        this.renewInterval = setInterval(async () => {
            if (await this.isLeader()) {
                await this.redisClient.pexpire(this.responsibility, this.ttl);
                logger.info(`Hostname [${this.instanceId}] had its leadership extended`);
            } else {
                clearInterval(this.renewInterval!);
                this.renewInterval = null;
                logger.warn(`Hostname [${this.instanceId}] has lost its leadership`);
            }
        }, this.ttl / 2);
    }
}
