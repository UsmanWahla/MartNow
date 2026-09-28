const { ServiceError } = require("./errors");

function readStorefrontText(value, label, maxLength) {
    const text = String(value || "").trim();

    if (text.length > maxLength) {
        throw new ServiceError(400, `${label} must be ${maxLength} characters or fewer`);
    }

    return text || null;
}

module.exports = { readStorefrontText };
