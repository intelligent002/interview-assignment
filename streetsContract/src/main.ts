import {StreetsService} from './israeliStreets';


StreetsService
    .getStreetsInCity('Ma\'ale Adumim', 3)
    .then((data) => {
        data.streets.slice(0, 3).forEach(element => {
            StreetsService.getStreetInfoById(element.streetId).then((data) => console.log(data));
        })
    });
