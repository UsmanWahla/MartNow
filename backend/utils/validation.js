const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
    return typeof email === "string" && EMAIL_PATTERN.test(email.trim());
}

function getPasswordError(password) {
    if (typeof password !== "string" || password.length < 8) {
        return "Password must be at least 8 characters";
    }

    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        return "Password must include a letter and a number";
    }

    return null;
}

function normalizeEmail(email) {
    return String(email).trim().toLowerCase();
}

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

function isValidUsername(username) {
    return typeof username === "string" && USERNAME_PATTERN.test(username.trim().toLowerCase());
}

function normalizeUsername(username) {
    return String(username || "").trim().toLowerCase();
}

module.exports = {
    isValidEmail,
    getPasswordError,
    normalizeEmail,
    isValidUsername,
    normalizeUsername
};
