const https = require("https");
const { ServiceError } = require("../utils/errors");
const { parseLatitude, parseLongitude } = require("../utils/coordinates");

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const CACHE_TTL_MS = 10 * 60 * 1000;
const MIN_REQUEST_INTERVAL_MS = 1000;
const cache = new Map();
let lastRequestAt = 0;

function cacheResult(key, value) {
    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });

    if (cache.size > 100) {
        cache.delete(cache.keys().next().value);
    }
}

function getCachedResult(key) {
    const entry = cache.get(key);

    if (!entry || entry.expiresAt <= Date.now()) {
        cache.delete(key);
        return null;
    }

    return entry.value;
}

function requestNominatim(path) {
    return new Promise((resolve, reject) => {
        const request = https.get(
            `${NOMINATIM_BASE_URL}${path}`,
            {
                headers: {
                    "Accept-Language": "en",
                    "User-Agent": process.env.LOCATION_SEARCH_USER_AGENT || "RetailPlatform location search"
                }
            },
            (response) => {
                let body = "";

                response.on("data", (chunk) => {
                    body += chunk;

                    if (body.length > 1_000_000) {
                        request.destroy();
                        reject(new ServiceError(502, "Location search returned an invalid response"));
                    }
                });

                response.on("end", () => {
                    if (response.statusCode !== 200) {
                        reject(new ServiceError(503, "Location search is unavailable. Please try again."));
                        return;
                    }

                    try {
                        resolve(JSON.parse(body));
                    } catch {
                        reject(new ServiceError(502, "Location search returned an invalid response"));
                    }
                });
            }
        );

        request.setTimeout(8000, () => {
            request.destroy();
            reject(new ServiceError(503, "Location search timed out. Please try again."));
        });
        request.on("error", () => {
            reject(new ServiceError(503, "Location search is unavailable. Please try again."));
        });
    });
}

async function getNominatimResult(cacheKey, path) {
    const cached = getCachedResult(cacheKey);

    if (cached) {
        return cached;
    }

    const waitFor = lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now();

    if (waitFor > 0) {
        throw new ServiceError(429, "Please wait a moment before searching another location");
    }

    lastRequestAt = Date.now();
    const result = await requestNominatim(path);
    cacheResult(cacheKey, result);
    return result;
}

function toLocation(row) {
    try {
        const latitude = parseLatitude(row.lat);
        const longitude = parseLongitude(row.lon);
        const address = String(row.display_name || "").trim();

        if (latitude == null || longitude == null || !address) {
            return null;
        }

        return { address, latitude, longitude };
    } catch {
        return null;
    }
}

async function searchLocations(value) {
    const search = String(value || "").trim().replace(/\s+/g, " ");

    if (search.length < 3) {
        throw new ServiceError(400, "Enter at least 3 characters to search for a location");
    }

    const cacheKey = `search:${search.toLowerCase()}`;
    const rows = await getNominatimResult(
        cacheKey,
        `/search?format=jsonv2&limit=5&q=${encodeURIComponent(search)}`
    );

    return rows.map(toLocation).filter(Boolean);
}

async function reverseLocation(latitudeValue, longitudeValue) {
    const latitude = parseLatitude(latitudeValue);
    const longitude = parseLongitude(longitudeValue);

    if (latitude == null || longitude == null) {
        throw new ServiceError(400, "A valid location is required");
    }

    const cacheKey = `reverse:${latitude}:${longitude}`;
    const row = await getNominatimResult(
        cacheKey,
        `/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`
    );
    const location = toLocation({
        ...row,
        lat: row.lat ?? latitude,
        lon: row.lon ?? longitude
    });

    if (!location) {
        throw new ServiceError(404, "No address was found for this location");
    }

    return location;
}

module.exports = { searchLocations, reverseLocation };
