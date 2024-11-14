import {Collection, Document, MongoClient} from 'mongodb';
import {MONGO_COLLECTION, MONGO_DB_NAME, MONGO_DSN} from './config';
import logger from "./logger";

let client: MongoClient | null = null;

export async function mongoCollection(): Promise<Collection<Document>> {
    if (!client) {
        client = new MongoClient(MONGO_DSN);
        await client.connect();
        logger.info('MongoDB connected.');
    }
    return client.db(MONGO_DB_NAME).collection(MONGO_COLLECTION);
}

export async function mongoDisconnect() {
    if (client) {
        await client.close();
        logger.info('MongoDB disconnected');
        client = null;
    }
}
