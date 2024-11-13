import Redis from 'ioredis';
import os from "os";

export class redisLeadership {

    private redisClient: Redis;
    private readonly responsibility: string;
    private readonly ttl: number; // Time-to-live in milliseconds
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
        this.instanceId = os.hostname(); // Unique identifier for this instance
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
            console.log(`Hostname [${this.instanceId}] is the horde leader now!`);
            this.scheduleRenewal();
            return true;
        }
        console.log(`Hostname [${this.instanceId}] is just a sidekick, dreaming of the Big Chair!`);
        return false;
    }

    async relinquishLeadership(): Promise<void> {
        // wipe redis mention
        if (await this.isLeader()) {
            await this.redisClient.del(this.responsibility);
            console.log(`Hostname [${this.instanceId}] has relinquished its leadership`);
        }
        // wipe renew interval
        if (this.renewInterval) {
            clearInterval(this.renewInterval);
            this.renewInterval = null;
        }
    }

    private scheduleRenewal(): void {
        if (this.renewInterval) {
            clearInterval(this.renewInterval);
        }

        // Schedule renewal at half the TTL to ensure leadership retention
        this.renewInterval = setInterval(async () => {
            if (await this.isLeader()) {
                await this.redisClient.pexpire(this.responsibility, this.ttl);
                console.log(`Hostname [${this.instanceId}] had its leadership extended`);
            } else {
                clearInterval(this.renewInterval!);
                this.renewInterval = null;
                console.log(`Hostname [${this.instanceId}] has lost its leadership`);
            }
        }, this.ttl / 2);
    }
}
