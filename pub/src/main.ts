import { Kafka } from 'kafkajs';
import { StreetsService, city } from 'data-gov-il-client';

// Kafka configuration
const kafka = new Kafka({
    clientId: 'street-producer',
    brokers: ['localhost:9092'] // Update this with your Kafka broker addresses
});

const producer = kafka.producer();

// Define a function to load streets and push to Kafka
async function loadStreetsAndPushToKafka(cityName: city, limit: number) {
    try {
        // Initialize Kafka producer
        await producer.connect();

        // Retrieve the list of streets for the given city
        const streetsData = await StreetsService.getStreetsInCity(cityName, limit);
        console.log(`Loaded streets for city: ${cityName}`);

        // Prepare messages for Kafka
        const messages = streetsData.streets.map(street => ({
            key: String(street.streetId),
            value: JSON.stringify(street),
        }));

        // Send messages to Kafka topic 'streets'
        await producer.send({
            topic: 'streets',
            messages: messages,
        });

        console.log(`Pushed ${messages.length} streets to Kafka for city: ${cityName}`);
    } catch (error) {
        console.error('Error loading streets or pushing to Kafka:', error);
    } finally {
        // Disconnect producer after sending messages
        await producer.disconnect();
    }
}

// Usage example
(async () => {
    const cityName: city = 'Jerusalem'; // Replace with a city from the cities.ts list
    const limit = 10; // Specify the number of streets to fetch

    await loadStreetsAndPushToKafka(cityName, limit);
})();
