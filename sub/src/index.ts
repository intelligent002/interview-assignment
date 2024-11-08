import { StreetsService } from 'data-gov-il-client';
import { connectToMongo, closeMongoConnection } from './mongoClient';
import { consumeFromKafka } from './kafkaConsumer';

const processStreetId = async (streetId: string) => {
    try {
        const streetData = await StreetsService.getStreetInfoById(parseInt(streetId));
        const collection = await connectToMongo();
        await collection.insertOne(streetData);
        console.log('Inserted street data into MongoDB:', streetData);
    } catch (error) {
        console.error('Error processing street ID:', error);
    }
};

const main = async () => {
    await consumeFromKafka(processStreetId);
    process.on('SIGINT', async () => {
        await closeMongoConnection();
        process.exit();
    });
};

main();
