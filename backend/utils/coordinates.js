const { ServiceError } = require("./errors");

function parseCoordinate(value, label, min, max) {
    if (value === "" || value == null) {
        return null;
    }

    const amount = Number(value);

    if (!Number.isFinite(amount) || amount < min || amount > max) {
        throw new ServiceError(400, `${label} must be between ${min} and ${max}`);
    }

    return Math.round(amount * 10_000_000) / 10_000_000;
}

function parseLatitude(value) {
    return parseCoordinate(value, "Latitude", -90, 90);
}

function parseLongitude(value) {
    return parseCoordinate(value, "Longitude", -180, 180);
}

module.exports = { parseLatitude, parseLongitude };
