class ServiceError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
        this.name = "ServiceError";
    }
}

module.exports = { ServiceError };
