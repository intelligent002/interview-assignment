export class ErrorRateLimit extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ErrorRateLimit';
    }
}