import {StreetsService} from 'data-gov-il-client';
import {sendToKafka} from './kafkaProducer';
import {exists} from "node:fs";

const main = async () => {
    // Get the city from the command line argument
    let cityName = process.argv[2];

    if (!cityName) {
        console.error('Please provide a city name as a command-line argument.');
        //process.exit(1);
        cityName = "Jerusalem"
    }

    try {
        const response = await StreetsService.getStreetsInCity(cityName, 10);
        const streetIds = response.streets.map((street) => street.streetId.toString());
        await sendToKafka(streetIds);
    } catch (error) {
        console.error('Error:', error);
    }
};

main();
