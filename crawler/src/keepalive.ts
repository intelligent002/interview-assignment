import axios from 'axios';
import http from 'http';
import https from 'https';

// Create an HTTP/HTTPS agent with keep-alive enabled
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

// Configure Axios instance with the agent
const axiosInstance = axios.create({
    httpAgent,
    httpsAgent,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Define the function for fetching streets
const fetchStreets = async (city: string, cities: Record<string, any>, limit: number) => {
    try {
        const res = (
            await axiosInstance.post('https://data.gov.il/api/3/action/datastore_search', {
                resource_id: '1b14e41c-85b3-4c21-bdce-9fe48185ffca',
                filters: { city_name: cities[city] },
                limit,
            })
        ).data;

        const results = res.result.records;
        if (!results || !results.length) {
            throw new Error('No streets found for city: ' + city);
        }

        const streets: { streetId: number; street_name: string }[] = results.map((street: any) => ({
            streetId: street._id,
            street_name: street.street_name.trim(),
        }));

        return { city, streets };
    } catch (error) {
        const err=error as Error;
        console.error('Error fetching streets for city:', city, err.message);
        throw error;
    }
};

// Function to perform multiple requests
const performMultipleCityRequests = async () => {
    const cities = {
        first: 'Tel Aviv Jaffa',
        second: 'Tel Aviv Jaffa',
        third: 'Tel Aviv Jaffa',
    };
    const limit = 10;

    for (const city of Object.values(cities)) {
        try {
            console.log(`Fetching streets for ${city}...`);
            const result = await fetchStreets(city, cities, limit);
            console.log(`Streets for ${city}:`, result.streets);
        } catch (error) {
            const err=error as Error;
            console.error('Failed to fetch streets for', city, err.message);
        }
    }

    // Clean up the agents after requests
    httpAgent.destroy();
    httpsAgent.destroy();
};

// Run the requests
performMultipleCityRequests();