import { MongoClient } from 'mongodb';
import { MONGO_URI, MONGO_DB_NAME, MONGO_COLLECTION } from './config';

let client: MongoClient;

export const connectToMongo = async () => {
    if (!client) {
        client = new MongoClient(MONGO_URI);
        await client.connect();
        console.log('Connected to MongoDB');
    }
    return client.db(MONGO_DB_NAME).collection(MONGO_COLLECTION);
};

export const closeMongoConnection = async () => {
    if (client) {
        await client.close();
        console.log('MongoDB connection closed');
    }
};
