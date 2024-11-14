import {city} from 'data-gov-il-client';
import {kafkaAdminInit} from './kafka/kafkaAdmin';
import {kafkaProduce, kafkaProducerConnect, kafkaProducerDisconnect} from './kafka/kafkaProducer';
import {KAFKA_TOPIC_CITIES} from "./config";

const main = async () => {
    try {
        // Create required topics if they are not created yet.
        await kafkaAdminInit();

        // Connect producer
        await kafkaProducerConnect()

        // Get the city from the command line argument
        let cityName: city = <city>process.argv[2].toString();

        // Boil out if no city specified
        if (!cityName) {
            console.error('Please provide a city name as a command-line argument.');
            process.exit(1);
            // cityName = "Jerusalem"
        }

        // Produce the city into cities topic, to guarantee the processing
        await kafkaProduce({topic: KAFKA_TOPIC_CITIES, messages: [cityName]});

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await kafkaProducerDisconnect()
    }
};

main();
