export class NoCloseMatchCity extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ErrorEmptyResponse';
    }
}