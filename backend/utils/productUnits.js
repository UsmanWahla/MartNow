const { ServiceError } = require("./errors");

const INVENTORY_TYPES = new Set(["unit", "weight", "volume", "length", "pack"]);
const BASE_UNITS = new Set(["piece", "kg", "liter", "meter"]);
const SALE_UNITS = new Set([
    "piece",
    "pair",
    "dozen",
    "pack",
    "box",
    "kg",
    "gram",
    "liter",
    "ml",
    "meter"
]);

const TYPE_DEFAULTS = {
    unit: { baseUnit: "piece", saleUnit: "piece", step: 1, conversion: 1 },
    weight: { baseUnit: "kg", saleUnit: "kg", step: 0.25, conversion: 1 },
    volume: { baseUnit: "liter", saleUnit: "liter", step: 0.25, conversion: 1 },
    length: { baseUnit: "meter", saleUnit: "meter", step: 0.25, conversion: 1 },
    pack: { baseUnit: "piece", saleUnit: "dozen", step: 1, conversion: 12 }
};

function roundQuantity(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number * 1000) / 1000 : 0;
}

function roundUnitCost(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number * 10000) / 10000 : 0;
}

function readProductUnits(data = {}, existing = {}) {
    const inventoryType = String(data.inventory_type ?? existing.inventory_type ?? "unit").trim();

    if (!INVENTORY_TYPES.has(inventoryType)) {
        throw new ServiceError(400, "Choose a valid inventory type");
    }

    const defaults = TYPE_DEFAULTS[inventoryType];
    const baseUnit = String(data.base_unit ?? existing.base_unit ?? defaults.baseUnit).trim();
    const saleUnit = String(data.sale_unit ?? existing.sale_unit ?? defaults.saleUnit).trim();
    const quantityStep = roundQuantity(
        data.quantity_step ?? existing.quantity_step ?? defaults.step
    );
    const unitsPerSaleUnit = roundQuantity(
        data.units_per_sale_unit ?? existing.units_per_sale_unit ?? defaults.conversion
    );

    if (!BASE_UNITS.has(baseUnit) || !SALE_UNITS.has(saleUnit)) {
        throw new ServiceError(400, "Choose valid product units");
    }

    if (quantityStep <= 0 || unitsPerSaleUnit <= 0) {
        throw new ServiceError(400, "Quantity step and unit conversion must be greater than zero");
    }

    return {
        inventoryType,
        baseUnit,
        saleUnit,
        quantityStep,
        unitsPerSaleUnit
    };
}

function toBaseQuantity(saleQuantity, conversion) {
    return roundQuantity(roundQuantity(saleQuantity) * roundQuantity(conversion || 1));
}

function toSaleQuantity(baseQuantity, conversion) {
    const factor = roundQuantity(conversion || 1);
    return factor > 0 ? roundQuantity(roundQuantity(baseQuantity) / factor) : 0;
}

function assertSaleQuantity(quantity, step) {
    const value = roundQuantity(quantity);
    const increment = roundQuantity(step || 1);

    if (value <= 0) {
        throw new ServiceError(400, "Quantity must be greater than zero");
    }

    const units = value / increment;

    if (Math.abs(units - Math.round(units)) > 0.000001) {
        throw new ServiceError(400, `Quantity must use increments of ${increment}`);
    }

    return value;
}

module.exports = {
    INVENTORY_TYPES,
    BASE_UNITS,
    SALE_UNITS,
    TYPE_DEFAULTS,
    roundQuantity,
    roundUnitCost,
    readProductUnits,
    toBaseQuantity,
    toSaleQuantity,
    assertSaleQuantity
};
