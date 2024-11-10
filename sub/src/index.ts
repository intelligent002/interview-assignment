import {mongoConnect, mongoDisconnect} from './mongoClient';
import {consumeFromKafka} from './kafka/kafkaConsumer';
import {startMetricsServer} from './metrics';
import {kafkaProducerConnect, kafkaProducerDisconnect} from "./kafka/kafkaProducer";

const main = async () => {
    // Start the metrics server
    startMetricsServer();

    // get mongo
    const mongo = await mongoConnect();

    // prepare to reproduce
    await kafkaProducerConnect();

    // consume and reproduce
    await consumeFromKafka(mongo);

    process.on('SIGINT', async () => {
        await mongoDisconnect();
        await kafkaProducerDisconnect();
        process.exit();
    });
};

main();
