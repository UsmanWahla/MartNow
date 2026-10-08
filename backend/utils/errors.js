class ServiceError extends Error {
    constructor(status, message, details = null) {
        super(message);
        this.status = status;
        this.name = "ServiceError";
        this.details = details;
    }
}

module.exports = { ServiceError };
