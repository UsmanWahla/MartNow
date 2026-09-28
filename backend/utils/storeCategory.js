const STORE_CATEGORIES = {
    pharmacy: "Pharmacy",
    book_shop: "Book Shop",
    mart: "Mart / General Store",
    clothing: "Clothing / Fashion",
    electronics: "Electronics",
    beauty: "Cosmetics / Beauty",
    food: "Food / Restaurant",
    other: "Other"
};

function readStoreType(value, customValue, { requireCustom = false } = {}) {
    const category = String(value || "other").trim().toLowerCase();
    const customStoreType = String(customValue || "").trim().slice(0, 100);

    if (!Object.hasOwn(STORE_CATEGORIES, category)) {
        throw new Error("Invalid store category");
    }

    if (category === "other" && requireCustom && !customStoreType) {
        throw new Error("Enter the store type");
    }

    return {
        storeType:
            category === "other"
                ? customStoreType || STORE_CATEGORIES.other
                : STORE_CATEGORIES[category]
    };
}

function categoryForStoreType(storeType) {
    const normalized = String(storeType || "").trim().toLowerCase();
    const category = Object.entries(STORE_CATEGORIES).find(
        ([, label]) => label.toLowerCase() === normalized
    );

    return category ? category[0] : "other";
}

module.exports = { STORE_CATEGORIES, readStoreType, categoryForStoreType };
