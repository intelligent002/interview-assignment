import {Collection, Document, MongoClient} from 'mongodb';
import {MONGO_COLLECTION, MONGO_DB_NAME, MONGO_DSN} from './config';

let client: MongoClient | null = null;

export async function mongoCollection(): Promise<Collection<Document>> {
    if (!client) {
        client = new MongoClient(MONGO_DSN);
        await client.connect();
        console.log('MongoDB connected.');
    }
    return client.db(MONGO_DB_NAME).collection(MONGO_COLLECTION);
}

export async function mongoDisconnect() {
    if (client) {
        await client.close();
        console.log('MongoDB disconnected');
        client = null;
    }
}
