const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const { query } = require("../utils/query");
const { deleteTenantData } = require("../utils/tenantCleanup");
const db = require("../db");
const authService = require("../services/authService");
const productService = require("../services/productService");
const saleService = require("../services/saleService");
const dashboardService = require("../services/dashboardService");
const stockService = require("../services/stockService");
const staffService = require("../services/staffService");
const { requireRole } = require("../middleware/auth");

const email = `test.stock.${Date.now()}@example.com`;
const password = "Testpass1";
let userId = 0;
let cashierEmail = "";
let signupRefresh = "";

function fakeRes() {
    return {
        writeHead() {},
        end() {},
        statusCode: 0
    };
}

describe("login, cost, profit, stock, and roles", { concurrency: 1 }, () => {
    before(async () => {
        const signedUp = await authService.signup({
            name: "Test User",
            email,
            password
        });

        userId = signedUp.user.id;
        signupRefresh = signedUp.refreshToken;
        assert.ok(signedUp.token);
        assert.ok(signedUp.refreshToken);
        assert.equal(signedUp.user.role, "owner");
        assert.equal(signedUp.user.tenantId, userId);
    });

    after(async () => {
        if (userId) {
            await deleteTenantData(userId);
        }

        db.end();
    });

    it("logs in with the new account", async () => {
        const result = await authService.login({ email, password });
        assert.equal(result.user.email, email);
        assert.equal(result.user.role, "owner");
        assert.ok(result.token);
    });

    it("rejects a wrong password", async () => {
        await assert.rejects(
            () => authService.login({ email, password: "Wrongpass1" }),
            (error) => error.status === 401
        );
    });

    it("adds a product with cost, snapshots a sale, and tracks profit", async () => {
        const added = await productService.addProduct(userId, {
            name: "Test Mouse",
            price: 10,
            cost_price: 6,
            stock: 8
        });

        assert.equal(added.product.name, "Test Mouse");
        assert.equal(Number(added.product.stock), 8);
        assert.equal(Number(added.product.cost_price), 6);

        const sold = await saleService.addSale(userId, {
            product_id: added.product.id,
            quantity: 2
        });

        assert.equal(Number(sold.sale.quantity), 2);
        assert.equal(Number(sold.sale.total_amount), 20);
        assert.equal(Number(sold.sale.cost_amount), 12);
        assert.equal(Number(sold.product.stock), 6);

        const afterSale = await productService.listProducts(userId);
        const updated = afterSale.rows.find((item) => item.id === added.product.id);

        assert.equal(Number(updated.stock), 6);

        const stats = await dashboardService.getStats(userId, "all");
        assert.equal(stats.totalProducts, 1);
        assert.equal(stats.totalStock, 6);
        assert.equal(stats.revenue, 20);
        assert.equal(stats.billed, 20);
        assert.equal(stats.collected, 20);
        assert.equal(stats.cost, 12);
        assert.equal(stats.profit, 8);
        assert.equal(stats.netProfit, 8);
        assert.equal(stats.udhaar, 0);

        const stockIn = await stockService.addMovement(userId, userId, {
            product_id: added.product.id,
            type: "in",
            quantity: 4,
            note: "Restock"
        });

        assert.equal(Number(stockIn.product.stock), 10);

        const ledger = await productService.getLedger(userId, added.product.id);
        assert.equal(ledger.rows.length, 3);
        assert.equal(ledger.rows[0].type, "opening");
        assert.equal(ledger.rows[0].inbound, 8);
        assert.equal(ledger.rows[0].balance, 8);
        assert.equal(ledger.rows[1].type, "sale");
        assert.equal(ledger.rows[1].outbound, 2);
        assert.equal(ledger.rows[1].balance, 6);
        assert.equal(ledger.rows[2].type, "in");
        assert.equal(ledger.rows[2].inbound, 4);
        assert.equal(ledger.rows[2].balance, 10);
        assert.equal(ledger.totalIn, 12);
        assert.equal(ledger.totalOut, 2);

        const movements = await stockService.listMovements(userId);
        const types = movements.rows.map((row) => row.type).sort();
        assert.deepEqual(types, ["in", "opening", "sale"].sort());

        const stockInRow = movements.rows.find((row) => row.type === "in");
        const longNote = "Restock details ".repeat(30).trim();
        const updatedMovement = await stockService.updateMovement(userId, userId, stockInRow.id, {
            product_id: added.product.id,
            type: "in",
            quantity: 4,
            note: longNote
        });
        assert.equal(updatedMovement.movement.note, longNote);
        assert.ok(updatedMovement.movement.note.length > 200);
        assert.equal(Number(updatedMovement.product.stock), 10);

        await assert.rejects(
            () => stockService.updateMovement(userId, userId, stockInRow.id, { type: "sale" }),
            (error) => error.status === 400
        );

        await assert.rejects(
            () =>
                productService.addProduct(userId, {
                    name: "Test Mouse",
                    price: 10,
                    cost_price: 6,
                    stock: 1
                }),
            (error) => error.status === 409
        );

        const customerService = require("../services/customerService");
        const expenseService = require("../services/expenseService");
        const customer = await customerService.addCustomer(userId, {
            name: "Ali"
        });
        const renamed = await customerService.updateCustomer(userId, customer.customer.id, {
            name: "Ali",
            phone: "0300"
        });
        assert.equal(renamed.customer.phone, "0300");
        const extra = await productService.addProduct(userId, {
            name: "Test Pad",
            sku: "PAD-1",
            price: 5,
            cost_price: 2,
            stock: 4
        });
        const invoice = await saleService.addSale(userId, {
            items: [
                { product_id: added.product.id, quantity: 1 },
                { product_id: extra.product.id, quantity: 1 }
            ],
            customer_id: customer.customer.id,
            paid_amount: 10
        });
        assert.equal(Number(invoice.sale.total_amount), 15);
        assert.equal(Number(invoice.sale.due_amount), 5);
        assert.equal(invoice.sale.items.length, 2);

        const expense = await expenseService.addExpense(userId, userId, {
            amount: 3,
            note: "Transport"
        });
        const updatedExpense = await expenseService.updateExpense(
            userId,
            expense.expense.id,
            { amount: 3, note: "Fuel" }
        );
        assert.equal(updatedExpense.expense.note, "Fuel");
        const afterExpense = await dashboardService.getStats(userId, "all");
        assert.equal(afterExpense.billed, 35);
        assert.equal(afterExpense.collected, 30);
        assert.equal(afterExpense.revenue, 35);
        assert.equal(afterExpense.udhaar, 5);
        assert.equal(afterExpense.debtors.length, 1);
        assert.equal(afterExpense.debtors[0].name, "Ali");
        assert.equal(afterExpense.debtors[0].balance, 5);
        assert.equal(afterExpense.cost, 20);
        assert.equal(afterExpense.profit, 15);
        assert.equal(afterExpense.expenses, 3);
        assert.equal(afterExpense.netProfit, 12);

        await customerService.payCustomer(userId, customer.customer.id, 5);
        const afterPay = await dashboardService.getStats(userId, "all");
        assert.equal(afterPay.udhaar, 0);
        assert.equal(afterPay.debtors.length, 0);
        assert.equal(afterPay.billed, 35);
        assert.equal(afterPay.revenue, 35);
        assert.equal(afterPay.cost, 20);
        assert.equal(afterPay.profit, 15);
        assert.equal(afterPay.netProfit, 12);

        const refreshed = await authService.refresh(signupRefresh);
        assert.ok(refreshed.token);
        assert.notEqual(refreshed.refreshToken, signupRefresh);
    });

    it("creates cashier staff under the shop tenant", async () => {
        cashierEmail = `cashier.${Date.now()}@example.com`;
        const created = await staffService.createStaff(userId, {
            name: "Shop Cashier",
            email: cashierEmail,
            password: "Cashpass1",
            role: "cashier"
        });

        assert.equal(created.user.role, "cashier");
        assert.equal(created.user.tenantId, userId);

        const token = jwt.sign(
            {
                id: created.user.id,
                email: cashierEmail,
                role: "cashier",
                tenantId: userId
            },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        assert.equal(payload.tenantId, userId);
        assert.equal(payload.role, "cashier");

        const products = await productService.listProducts(payload.tenantId);
        assert.ok(products.rows.length >= 1);

        const blocked = requireRole(
            { headers: { authorization: `Bearer ${token}` } },
            fakeRes(),
            ["owner", "manager"]
        );
        assert.equal(blocked, null);
    });

    it("uses decimal units and FIFO costs across purchase batches and variants", async () => {
        const mango = await productService.addProduct(userId, {
            name: "FIFO Mango",
            price: 700,
            cost_price: 500,
            stock: 10,
            inventory_type: "weight",
            base_unit: "kg",
            sale_unit: "kg",
            quantity_step: 0.5,
            units_per_sale_unit: 1
        });

        const firstSale = await saleService.addSale(userId, {
            product_id: mango.product.id,
            quantity: 5
        });
        assert.equal(Number(firstSale.sale.cost_amount), 2500);
        assert.equal(Number(firstSale.product.stock), 5);

        await stockService.addMovement(userId, userId, {
            product_id: mango.product.id,
            type: "in",
            quantity: 10,
            quantity_unit: "kg",
            unit_cost: 600,
            new_sale_price: 800
        });

        const mixedSale = await saleService.addSale(userId, {
            product_id: mango.product.id,
            quantity: 6
        });
        assert.equal(Number(mixedSale.sale.total_amount), 4800);
        assert.equal(Number(mixedSale.sale.cost_amount), 3100);
        assert.equal(Number(mixedSale.product.stock), 9);

        const batchesAfterSale = await query(
            `
            SELECT initial_quantity, remaining_quantity, unit_cost
            FROM inventory_batches
            WHERE product_id = ?
            ORDER BY received_at, id
            `,
            [mango.product.id]
        );
        assert.deepEqual(
            batchesAfterSale.map((row) => [
                Number(row.initial_quantity),
                Number(row.remaining_quantity),
                Number(row.unit_cost)
            ]),
            [[10, 0, 500], [10, 9, 600]]
        );

        await saleService.deleteSale(userId, mixedSale.sale.id);
        const halfKilo = await saleService.addSale(userId, {
            product_id: mango.product.id,
            quantity: 0.5
        });
        assert.equal(Number(halfKilo.sale.total_amount), 400);
        assert.equal(Number(halfKilo.sale.cost_amount), 250);
        assert.equal(Number(halfKilo.product.stock), 14.5);

        const shirt = await productService.addProduct(userId, {
            name: "FIFO Shirt",
            price: 300,
            cost_price: 100,
            stock: 2,
            inventory_type: "unit",
            base_unit: "piece",
            sale_unit: "piece",
            quantity_step: 1,
            units_per_sale_unit: 1,
            colors: [{ name: "Black", hex: "#111827" }],
            sizes: ["M"],
            variants: [{ color: "Black", size: "M", stock: 2 }]
        });
        await stockService.addMovement(userId, userId, {
            product_id: shirt.product.id,
            type: "in",
            quantity: 2,
            unit_cost: 150,
            color: "Black",
            size: "M"
        });
        const shirtSale = await saleService.addSale(userId, {
            items: [{
                product_id: shirt.product.id,
                quantity: 3,
                color: "Black",
                size: "M"
            }]
        });
        assert.equal(Number(shirtSale.sale.cost_amount), 350);
        assert.equal(Number(shirtSale.product.stock), 1);

        const eggs = await productService.addProduct(userId, {
            name: "FIFO Eggs",
            price: 300,
            cost_price: 10,
            stock: 24,
            inventory_type: "pack",
            base_unit: "piece",
            sale_unit: "dozen",
            quantity_step: 1,
            units_per_sale_unit: 12
        });
        const dozenSale = await saleService.addSale(userId, {
            product_id: eggs.product.id,
            quantity: 1
        });
        assert.equal(Number(dozenSale.sale.cost_amount), 120);
        assert.equal(Number(dozenSale.product.stock), 12);
    });

    it("lets only one concurrent sale take the last unit", async () => {
        const added = await productService.addProduct(userId, {
            name: "Last Unit",
            price: 10,
            cost_price: 4,
            stock: 1
        });

        const results = await Promise.allSettled([
            saleService.addSale(userId, {
                items: [{ product_id: added.product.id, quantity: 1 }]
            }),
            saleService.addSale(userId, {
                items: [{ product_id: added.product.id, quantity: 1 }]
            })
        ]);

        const fulfilled = results.filter((row) => row.status === "fulfilled");
        const rejected = results.filter((row) => row.status === "rejected");
        assert.equal(fulfilled.length, 1);
        assert.equal(rejected.length, 1);
        assert.equal(rejected[0].reason.status, 400);

        const leftover = await productService.getProduct(userId, added.product.id);
        assert.equal(Number(leftover.stock), 0);
    });

    it("unlinks paid sales when deleting a customer", async () => {
        const customerService = require("../services/customerService");
        const customer = await customerService.addCustomer(userId, {
            name: "Delete Me"
        });
        const product = await productService.addProduct(userId, {
            name: "Paid Line",
            price: 4,
            cost_price: 1,
            stock: 2
        });
        await saleService.addSale(userId, {
            items: [{ product_id: product.product.id, quantity: 1 }],
            customer_id: customer.customer.id,
            paid_amount: 4
        });

        const result = await customerService.deleteCustomer(
            userId,
            customer.customer.id
        );
        assert.equal(result.message, "Customer deleted");
    });

    it("sets httpOnly cookies on login and allows cookie auth", async () => {
        const { Readable } = require("node:stream");
        const handleAuthRoutes = require("../routes/auth");
        const handleCommissionRoutes = require("../routes/commission");
        const handleProductRoutes = require("../routes/products");
        const handleStoreTypeRoutes = require("../routes/storeTypes");

        function mockReq({ method, url, headers = {}, body }) {
            const chunks =
                body === undefined
                    ? []
                    : [Buffer.from(JSON.stringify(body))];
            const req = Readable.from(chunks);
            req.method = method;
            req.url = url;
            req.headers = { "content-type": "application/json", ...headers };
            req.socket = { remoteAddress: "127.0.0.1" };
            return req;
        }

        function mockRes() {
            return {
                statusCode: 0,
                headers: {},
                body: "",
                data: null,
                setHeader(name, value) {
                    this.headers[name] = value;
                },
                writeHead(code, headers) {
                    this.statusCode = code;
                    Object.assign(this.headers, headers || {});
                },
                end(data) {
                    this.body = data || "";
                    try {
                        this.data = JSON.parse(this.body);
                    } catch {
                        this.data = null;
                    }
                }
            };
        }

        function cookieHeader(res) {
            const raw = res.headers["Set-Cookie"];
            const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
            return list.map((item) => String(item).split(";")[0]).join("; ");
        }

        const loginReq = mockReq({
            method: "POST",
            url: "/api/login",
            body: { email, password }
        });
        const loginRes = mockRes();
        await handleAuthRoutes(loginReq, loginRes);
        assert.equal(loginRes.statusCode, 200);
        assert.ok(loginRes.data.user);
        const cookies = loginRes.headers["Set-Cookie"];
        assert.ok(Array.isArray(cookies));
        assert.ok(cookies.some((item) => String(item).includes("HttpOnly")));
        assert.ok(cookies.some((item) => String(item).startsWith("access_token=")));

        const listReq = mockReq({
            method: "GET",
            url: "/api/products?page=1&limit=5",
            headers: { cookie: cookieHeader(loginRes) }
        });
        const listRes = mockRes();
        await handleProductRoutes(listReq, listRes);
        assert.equal(listRes.statusCode, 200);
        assert.ok(Array.isArray(listRes.data.rows));
        assert.equal(typeof listRes.data.total, "number");

        const commissionReq = mockReq({
            method: "GET",
            url: "/api/commission/summary",
            headers: { cookie: cookieHeader(loginRes) }
        });
        const commissionRes = mockRes();
        await handleCommissionRoutes(commissionReq, commissionRes);
        assert.equal(commissionRes.statusCode, 200);
        assert.equal(commissionRes.data.commission_percent, 0);
        assert.equal(commissionRes.data.outstanding, 0);

        const storeTypesReq = mockReq({
            method: "GET",
            url: "/api/store-types",
            headers: { cookie: cookieHeader(loginRes) }
        });
        const storeTypesRes = mockRes();
        await handleStoreTypeRoutes(storeTypesReq, storeTypesRes);
        assert.equal(storeTypesRes.statusCode, 200);
        assert.ok(storeTypesRes.data.rows.some((type) => type.name === "Bakery"));
        assert.equal(storeTypesRes.data.rows.some((type) => type.name === "Other"), false);

        const cashierLoginReq = mockReq({
            method: "POST",
            url: "/api/login",
            body: { email: cashierEmail, password: "Cashpass1" }
        });
        const cashierLoginRes = mockRes();
        await handleAuthRoutes(cashierLoginReq, cashierLoginRes);
        assert.equal(cashierLoginRes.statusCode, 200);

        const blockedReq = mockReq({
            method: "POST",
            url: "/api/products",
            headers: { cookie: cookieHeader(cashierLoginRes) },
            body: { name: "Nope", price: 1, cost_price: 1, stock: 1 }
        });
        const blockedRes = mockRes();
        await handleProductRoutes(blockedReq, blockedRes);
        assert.equal(blockedRes.statusCode, 403);

        const blockedCommissionReq = mockReq({
            method: "GET",
            url: "/api/commission/summary",
            headers: { cookie: cookieHeader(cashierLoginRes) }
        });
        const blockedCommissionRes = mockRes();
        await handleCommissionRoutes(blockedCommissionReq, blockedCommissionRes);
        assert.equal(blockedCommissionRes.statusCode, 403);

        const blockedStoreTypesReq = mockReq({
            method: "GET",
            url: "/api/store-types",
            headers: { cookie: cookieHeader(cashierLoginRes) }
        });
        const blockedStoreTypesRes = mockRes();
        await handleStoreTypeRoutes(blockedStoreTypesReq, blockedStoreTypesRes);
        assert.equal(blockedStoreTypesRes.statusCode, 403);
    });

    it("lets a platform customer shop a store created by super admin APIs", async () => {
        const storeService = require("../services/storeService");
        const settingsService = require("../services/settingsService");
        const profileService = require("../services/profileService");
        const shopService = require("../services/shopService");
        const shopCartService = require("../services/shopCartService");
        const storeTypeService = require("../services/storeTypeService");
        const storeTypes = (await storeTypeService.listActiveStoreTypes()).rows;
        const pharmacyType = storeTypes.find((type) => type.code === "pharmacy_medical");
        const bakeryType = storeTypes.find((type) => type.code === "bakery");
        assert.ok(pharmacyType);
        assert.ok(bakeryType);
        const stamp = Date.now();
        const created = await storeService.createStore({
            name: "QA Mart",
            address: "Test Street",
            contact_name: "QA Owner",
            contact_phone: "03001112222",
            username: `qa.store.${stamp}`,
            password: "Storepass1",
            delivery_enabled: 1,
            commission_percent: 10,
            store_type_id: pharmacyType.id,
            logo_path: "/uploads/stores/qa-logo.webp"
        });

        assert.equal(created.store.store_type, "Pharmacy / Medical Store");
        assert.equal(created.store.store_type_id, pharmacyType.id);

        await assert.rejects(
            () => storeService.updateStore(created.store.id, { store_type_id: 999999 }),
            (error) => error.status === 400 && error.message === "Choose a valid store type"
        );

        const typed = await storeService.updateStore(created.store.id, {
            store_type_id: bakeryType.id
        });
        assert.equal(typed.store.store_type, "Bakery");

        const logoRemoved = await storeService.updateStore(created.store.id, {
            remove_logo: true
        });
        assert.equal(logoRemoved.store.logo_path, null);

        const publicStores = await storeService.listPublicStores();
        const publicStore = publicStores.rows.find((store) => store.id === created.store.id);
        assert.equal(publicStore?.store_type, "Bakery");

        const tenantId = created.store.tenant_user_id;
        const updatedProfile = await profileService.updateAccountProfile(
            tenantId,
            `${created.store.username}@store.local`,
            {
                name: "QA Account Owner",
                username: `qa.owner.${stamp}`,
                current_password: "Storepass1",
                avatar_path: "/uploads/avatars/qa-test.webp"
            }
        );
        assert.equal(updatedProfile.user.username, `qa.owner.${stamp}`);
        assert.equal(updatedProfile.user.avatar_path, "/uploads/avatars/qa-test.webp");

        const avatarRemoved = await profileService.updateAccountProfile(
            tenantId,
            `${created.store.username}@store.local`,
            {
                name: "QA Account Owner",
                username: `qa.owner.${stamp}`,
                remove_avatar: true
            }
        );
        assert.equal(avatarRemoved.user.avatar_path, null);

        const savedSettings = await settingsService.updateShopProfile(tenantId, {
            shop_name: "QA Bakery",
            shop_slug: created.store.shop_slug,
            low_stock_threshold: 4,
            address: "Updated Test Street",
            latitude: 33.6844,
            longitude: 73.0479,
            contact_name: "QA Contact",
            contact_phone: "03001112222",
            store_type_id: bakeryType.id,
            store_description: "Fresh QA products every day",
            business_hours: "Mon-Sat, 10 AM-9 PM",
            delivery_note: "Same-day delivery in the test area",
            logo_path: "/uploads/stores/qa-settings-logo.webp"
        });
        assert.equal(savedSettings.settings.shop_name, "QA Bakery");
        assert.equal(savedSettings.settings.contact_name, "QA Contact");
        assert.equal(savedSettings.settings.store_type, "Bakery");
        assert.equal(savedSettings.settings.latitude, 33.6844);
        assert.equal(savedSettings.settings.longitude, 73.0479);
        assert.equal(savedSettings.user.name, "QA Contact");
        assert.equal(savedSettings.settings.store_description, "Fresh QA products every day");
        assert.equal(savedSettings.settings.logo_path, "/uploads/stores/qa-settings-logo.webp");

        const settingsLogoRemoved = await settingsService.updateShopProfile(tenantId, {
            shop_name: "QA Bakery",
            shop_slug: created.store.shop_slug,
            low_stock_threshold: 4,
            remove_logo: true
        });
        assert.equal(settingsLogoRemoved.settings.logo_path, null);

        const shopMeta = await shopService.getShopMeta(created.store.shop_slug);
        assert.equal(shopMeta.business_hours, "Mon-Sat, 10 AM-9 PM");
        assert.equal(shopMeta.delivery_note, "Same-day delivery in the test area");
        assert.equal(shopMeta.latitude, 33.6844);
        assert.equal(shopMeta.longitude, 73.0479);

        const product = await productService.addProduct(tenantId, {
            name: "QA Mug",
            price: 40,
            cost_price: 10,
            stock: 5,
            category: "Homeware",
            featured: true
        });
        assert.equal(product.product.category, "Homeware");
        assert.equal(product.product.featured, true);
        const shopProducts = await shopService.listShopProducts(created.store.shop_slug, { all: true });
        assert.equal(shopProducts.rows.find((row) => row.id === product.product.id)?.featured, true);
        const buyer = await authService.signupCustomer({
            name: "QA Buyer",
            email: `qa.buyer.${stamp}@example.com`,
            password: "Buyerpass1"
        });
        const auth = { id: buyer.user.id, role: "customer", email: buyer.user.email };
        await shopCartService.addToCart(created.store.shop_slug, auth, {
            product_id: product.product.id,
            quantity: 2
        });
        const order = await shopCartService.checkout(created.store.shop_slug, auth, {
            name: "QA Buyer",
            email: buyer.user.email,
            phone: "0300",
            address: "House 1",
            city: "Lahore",
            payment_method: "cod",
            delivery_by: "store"
        });

        assert.equal(Number(order.platform_fee ?? 0) >= 0, true);
        const orders = await query(
            "SELECT user_id, platform_fee, commission_percent FROM shop_orders WHERE id = ?",
            [order.id]
        );
        assert.equal(Number(orders[0].user_id), tenantId);
        assert.equal(Number(orders[0].commission_percent), 10);

        const storeProducts = await storeService.listStoreProducts(created.store.id, { all: true });
        assert.equal(storeProducts.total, 1);
        assert.equal(storeProducts.rows[0].name, "QA Mug");

        const storeDetail = await storeService.getStoreDetail(created.store.id);
        assert.equal(storeDetail.store.id, created.store.id);
        assert.equal(storeDetail.overview.products, 1);
        assert.equal(storeDetail.overview.stock, 3);
        assert.equal(storeDetail.overview.online_orders, 1);
        assert.equal(storeDetail.overview.orders, 1);

        const commissionLedgerService = require("../services/commissionLedgerService");
        const storeCommission = await commissionLedgerService.getCommissionLedgerSummary({
            storeId: created.store.id
        });
        assert.equal(storeCommission.due, 0);
        assert.equal(storeCommission.received, 0);
        assert.equal(storeCommission.outstanding, 0);

        const orderService = require("../services/orderService");
        await orderService.updateOrderStatus(tenantId, order.id, "delivered");

        const chargedSummary = await commissionLedgerService.getStoreCommissionSummary(tenantId);
        const expectedCommission = Number(orders[0].platform_fee);
        assert.equal(chargedSummary.store_id, created.store.id);
        assert.equal(chargedSummary.commission_percent, 10);
        assert.equal(chargedSummary.due, expectedCommission);
        assert.equal(chargedSummary.received, 0);
        assert.equal(chargedSummary.outstanding, expectedCommission);

        const ownLedger = await commissionLedgerService.listStoreCommissionLedger(tenantId, {
            all: true,
            storeId: created.store.id + 9999
        });
        assert.equal(ownLedger.total, 1);
        assert.ok(ownLedger.rows.every((entry) => entry.store_id === created.store.id));

        await commissionLedgerService.recordCommissionSettlement(
            {
                store_id: created.store.id,
                amount: 3,
                note: "QA commission payment"
            },
            userId
        );
        const settledSummary = await commissionLedgerService.getStoreCommissionSummary(tenantId);
        assert.equal(settledSummary.received, 3);
        assert.equal(settledSummary.outstanding, expectedCommission - 3);

        await deleteTenantData(tenantId, { storeId: created.store.id });
        await query("DELETE FROM cart_items WHERE user_id = ?", [buyer.user.id]);
        await query("DELETE FROM refresh_tokens WHERE user_id = ?", [buyer.user.id]);
        await query("DELETE FROM users WHERE id = ?", [buyer.user.id]);
    });
});
