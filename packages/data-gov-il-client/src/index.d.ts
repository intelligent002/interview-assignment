// Declare the module for the 'data-gov-il-client' package
declare module 'src/index' {
    import { Axios } from 'axios';

    // Define the Street interface, based on the given code
    export interface Street {
        streetId: number;
        street_name: string;
    }

    // Define the ApiStreet interface with properties from the API
    export interface ApiStreet {
        _id: number;
        region_code: number;
        region_name: string;
        city_code: number;
        city_name: string;
        street_code: number;
        street_name: string;
        street_name_status: string;
        official_code: number;
    }

    // Define city as a string type for simplicity
    export type city = string;

    // Define cities and englishNameByCity objects
    export const cities: { [key: string]: city };
    export const englishNameByCity: { [key: string]: string };

    // Define the StreetsService class with its static methods
    export class StreetsService {
        private static _axios: Axios;

        static getStreetsInCity(city: city, limit: number): Promise<{
            city: city;
            streets: Pick<Street, 'streetId' | 'street_name'>[];
        }>;

        static getStreetInfoById(id: number): Promise<Street>;
    }
}
