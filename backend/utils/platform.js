const { toMoney } = require("./http");

function platformDeliveryFee() {
    const fee = Number(process.env.PLATFORM_DELIVERY_FEE);
    return Number.isFinite(fee) && fee >= 0 ? toMoney(fee) : 50;
}

module.exports = { platformDeliveryFee };
