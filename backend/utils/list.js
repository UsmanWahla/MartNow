function parseListOptions(opts = {}) {
    const search = String(opts.search || "").trim().slice(0, 80);
    const all = Boolean(opts.all);
    const page = Math.max(1, Number(opts.page) || 1);
    const limit = all ? 500 : Math.min(50, Math.max(1, Number(opts.limit) || 5));
    const productId = Math.max(0, Number(opts.productId) || 0);
    const storeId = Math.max(0, Number(opts.storeId) || 0);
    const date = String(opts.date || "").trim();
    const dateFrom = String(opts.dateFrom || date).trim();
    const dateTo = String(opts.dateTo || date).trim();
    const dateFilter = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
    const dateFromFilter = /^\d{4}-\d{2}-\d{2}$/.test(dateFrom) ? dateFrom : "";
    const dateToFilter = /^\d{4}-\d{2}-\d{2}$/.test(dateTo) ? dateTo : "";
    const deliveryByRaw = String(opts.deliveryBy || "").trim().toLowerCase();
    const deliveryBy = deliveryByRaw === "store" || deliveryByRaw === "platform" ? deliveryByRaw : "";

    return {
        search,
        page,
        limit,
        productId,
        storeId,
        date: dateFilter,
        dateFrom: dateFromFilter,
        dateTo: dateToFilter,
        deliveryBy,
        offset: (page - 1) * limit,
        limitSql: `LIMIT ${limit} OFFSET ${(page - 1) * limit}`
    };
}

function like(search) {
    return `%${search}%`;
}

function fromQuery(query) {
    return parseListOptions({
        search: query.get("q"),
        page: query.get("page"),
        limit: query.get("limit"),
        all: query.get("all") === "1",
        productId: query.get("product_id"),
        storeId: query.get("store_id"),
        date: query.get("date"),
        dateFrom: query.get("date_from"),
        dateTo: query.get("date_to"),
        deliveryBy: query.get("delivery_by")
    });
}

module.exports = { parseListOptions, like, fromQuery };
