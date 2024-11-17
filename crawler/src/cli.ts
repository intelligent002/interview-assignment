import didYouMean from 'didyoumean2';
import {cities, city} from 'data-gov-il-client';
import {kafkaProduce, kafkaProducerConnect, kafkaProducerDisconnect} from './kafka/kafkaProducer';
import {KAFKA_TOPIC_CITIES} from './config';

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
            console.log(`Auto corrected the city name: [${closestMatch}]`);
            cityName = <city>closestMatch; // Assign the closest match to cityName
        } else {
            throw new Error('No close match found for the provided city name.');
        }

        // Connect the Kafka producer
        await kafkaProducerConnect();

        // Produce the city into the cities topic, to guarantee processing
        await kafkaProduce({topic: KAFKA_TOPIC_CITIES, messages: [cityName]});
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await kafkaProducerDisconnect();
    }
};

main();