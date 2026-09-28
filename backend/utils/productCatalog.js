const { ServiceError } = require("./errors");

function readProductCategory(value) {
    const category = String(value || "").trim().replace(/\s+/g, " ");

    if (category.length > 60) {
        throw new ServiceError(400, "Product category must be 60 characters or fewer");
    }

    return category || null;
}

function readFeatured(value) {
    return value === true || value === 1 || ["1", "true", "on"].includes(String(value || "").toLowerCase());
}

module.exports = { readProductCategory, readFeatured };
