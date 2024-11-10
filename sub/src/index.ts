import {closeMongoConnection, connectToMongo} from './mongoClient';
import {consumeFromKafka} from './kafka/kafkaConsumer';
import {startMetricsServer} from './metrics';
import {Collection} from 'mongodb';
import {kafkaProducerConnect, kafkaProducerDisconnect} from "./kafka/kafkaProducer";

let mongoCollection: Collection

const main = async () => {
    // Start the metrics server
    startMetricsServer();

    // get mongo
    mongoCollection = await connectToMongo();

    // prepare to reproduce
    await kafkaProducerConnect();

    // consume and reproduce
    await consumeFromKafka(mongoCollection);

    process.on('SIGINT', async () => {
        await closeMongoConnection();
        await kafkaProducerDisconnect();
        process.exit();
    });
};

main();
