import didYouMean from 'didyoumean2';
import {cities, city} from 'data-gov-il-client';
import {kafkaProduce, kafkaProducerConnect, kafkaProducerDisconnect} from './kafka/kafkaProducer';
import {KAFKA_TOPIC_CITIES} from './config';
import logger from "./logger";
import {NoCloseMatchCity} from "./errors/NoCloseMatchCity";

const main = async () => {
    try {
        // Get the city from the command line argument
        let cityName: city = <city>process.argv[2]?.toString();

        // Exit if no city is specified
        if (!cityName) {
            console.error('Please provide a city name as a command-line argument.');
            process.exit(1);
        }

        // Extract city names from the cities object
        const cityList = Object.keys(cities);

        // Find the closest match using didyoumean2
        const closestMatch = didYouMean(cityName, cityList);

        if (closestMatch) {
            let message = `Auto corrected the city name: [${closestMatch}] from [${cityName}]`;
            // for user
            console.log(message)
            // for dev
            logger.debug(message)
            // for kafka
            cityName = <city>closestMatch;
        } else {
            let message = 'No close match found for the provided city name.';
            // for dev
            console.log(message)
            // for user
            throw new NoCloseMatchCity(message);
        }

        // Connect the Kafka producer
        await kafkaProducerConnect();

        // Produce the city into the cities topic, to guarantee processing
        await kafkaProduce({topic: KAFKA_TOPIC_CITIES, messages: [cityName]});

        // log the success
        logger.info(`Submitted city: [${cityName}] into kafka`)
    } catch (error) {
        if (error instanceof NoCloseMatchCity) {
            // for user
            console.error(error.message);
        } else {
            // for dev
            logger.error('Error processing city:', error);
        }
    } finally {
        await kafkaProducerDisconnect();
    }
};

main()
    .then(() => logger.info("City dispatched"))
    .catch(async (error) => {
        logger.error('Error:', error);
    });