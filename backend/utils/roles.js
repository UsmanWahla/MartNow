const OWNER = ["owner"];
const CATALOG = ["owner", "manager"];
const STOCK = CATALOG;
const REPORT = CATALOG;
const MANAGE_SALE = CATALOG;
const STAFF = ["owner", "manager", "cashier"];
const SHOPPER = ["shopper", "customer"];
const SUPER_ADMIN = ["super_admin"];

function isCustomerRole(role) {
    return role === "shopper" || role === "customer";
}

function isStaffRole(role) {
    return STAFF.includes(role);
}

module.exports = {
    OWNER,
    CATALOG,
    STOCK,
    REPORT,
    MANAGE_SALE,
    STAFF,
    SHOPPER,
    SUPER_ADMIN,
    isCustomerRole,
    isStaffRole
};
