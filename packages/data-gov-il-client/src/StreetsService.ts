import axios, { Axios, AxiosError } from 'axios';
import { omit } from 'lodash';
import { cities, city, englishNameByCity } from './cities';
import { ErrorRateLimit } from './errors/ErrorRateLimit';
import { ErrorEmptyResponse } from './errors/ErrorEmptyResponse';

export interface Street extends Omit<ApiStreet, '_id'> {
    streetId: number;
}

interface ApiStreet {
    _id: number;
    region_code?: number;
    region_name: string;
    city_code?: number;
    city_name: string;
    street_code?: number;
    street_name: string;
    street_name_status?: string;
    official_code?: number;
}

export class StreetsService {
    private static _axios: Axios;
    private static get axios() {
        if (!this._axios) {
            this._axios = axios.create({});
        }
        return this._axios;
    }

    private static handleAxiosError(error: AxiosError): never {
        if (error.response && error.response.status === 503) {
            console.error('Caught 503 error (instead of 429): we`ve just reached the RateLimit');
            throw new ErrorRateLimit('Streets rate limit');
        } else {
            console.error('An HTTP error occurred:', error.response?.status, error.message);
            throw new Error('Some recoverable error');
        }
    }

    static async getStreetsInCity(city: city, limit: number): Promise<{ city: city; streets: Pick<Street, 'streetId' | 'street_name'>[] }> {
        try {
            const res = (await this.axios.post('https://data.gov.il/api/3/action/datastore_search', {
                resource_id: `1b14e41c-85b3-4c21-bdce-9fe48185ffca`,
                filters: { city_name: cities[city] },
                limit,
            })).data;

            const results = res.result.records;
            if (!results || !results.length) {
                throw new ErrorEmptyResponse('No streets found for city: ' + city);
            }

            const streets: Pick<Street, 'streetId' | 'street_name'>[] = results.map((street: ApiStreet) => ({
                streetId: street._id,
                street_name: street.street_name.trim(),
            }));

            return { city, streets };
        } catch (error) {
            if (axios.isAxiosError(error)) {
                this.handleAxiosError(error);
            } else {
                console.error('An unexpected error occurred:', error);
                throw error; // Re-throw the error
            }
        }
    }

    static async getStreetInfoById(id: number) {
        try {
            const res = (await this.axios.post('https://data.gov.il/api/3/action/datastore_search', {
                resource_id: `1b14e41c-85b3-4c21-bdce-9fe48185ffca`,
                filters: { _id: id },
                limit: 1,
            })).data;

            const results = res.result.records;
            if (!results || !results.length) {
                throw new ErrorEmptyResponse('No street found for id: ' + id);
            }

            const dbStreet: ApiStreet = results[0];
            const cityName = englishNameByCity[dbStreet.city_name];
            const street: Street = {
                ...omit<ApiStreet>(dbStreet, '_id'),
                streetId: dbStreet._id,
                city_name: cityName,
                region_name: dbStreet.region_name.trim(),
                street_name: dbStreet.street_name.trim(),
            };

            return street;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                this.handleAxiosError(error);
            } else {
                console.error('An unexpected error occurred:', error);
                throw error; // Re-throw the error
            }
        }
    }
}
