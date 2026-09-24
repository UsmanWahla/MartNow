const { toMoney } = require("./http");

function mapOrderMoney(row) {
    const deliveryFee = toMoney(row.delivery_fee);
    const totalAmount = toMoney(row.total_amount);
    const deliveryBy = row.delivery_by || "store";
    const paidAmount = toMoney(row.paid_amount);

    return {
        delivery_by: deliveryBy,
        delivery_fee: deliveryFee,
        total_amount: totalAmount,
        payable_amount: toMoney(totalAmount + deliveryFee),
        paid_amount: paidAmount,
        due_amount: toMoney(totalAmount - paidAmount),
        store_amount: totalAmount,
        platform_delivery: deliveryBy === "platform" ? deliveryFee : 0
    };
}

module.exports = { mapOrderMoney };
