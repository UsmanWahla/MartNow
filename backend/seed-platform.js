require("dotenv").config();
const db = require("./db");
const { migrate } = require("./migrate-business");
const authService = require("./services/authService");
const storeService = require("./services/storeService");
const productService = require("./services/productService");

async function seed() {
    await migrate();

    const superEmail = process.env.SUPER_ADMIN_EMAIL || "admin@platform.local";
    const superPassword = process.env.SUPER_ADMIN_PASSWORD || "Adminpass1";
    let superUser;

    try {
        superUser = await authService.loginSuper({
            email: superEmail,
            password: superPassword
        });
    } catch (error) {
        throw new Error(`Super admin login failed: ${error.message}`);
    }

    const stores = await storeService.listStores({ all: true });

    if (stores.total === 0) {
        const first = await storeService.createStore({
            name: "Mint Mart",
            address: "Main Boulevard, Lahore",
            latitude: 31.5204,
            longitude: 74.3587,
            contact_name: "Ali Store",
            contact_phone: "03000000001",
            username: "mint-mart",
            password: "Storepass1",
            delivery_enabled: 1,
            commission_percent: 5
        });
        const second = await storeService.createStore({
            name: "Teal Traders",
            address: "Mall Road, Karachi",
            latitude: 24.8607,
            longitude: 67.0011,
            contact_name: "Sara Store",
            contact_phone: "03000000002",
            username: "teal-traders",
            password: "Storepass1",
            delivery_enabled: 0,
            commission_percent: 8
        });

        await productService.addProduct(first.store.tenant_user_id, {
            name: "Cotton Tee",
            price: 1200,
            cost_price: 700,
            stock: 12
        });
        await productService.addProduct(second.store.tenant_user_id, {
            name: "Canvas Tote",
            price: 800,
            cost_price: 300,
            stock: 20
        });
    }

    const customerEmail = "buyer@example.com";

    try {
        await authService.signupCustomer({
            name: "Demo Buyer",
            email: customerEmail,
            password: "Buyerpass1"
        });
    } catch (error) {
        if (error.status !== 409) {
            throw error;
        }
    }

    console.log(`Platform seed ready. Super admin: ${superUser.user.email}`);
}

seed()
    .then(() => {
        db.end(() => process.exit(0));
    })
    .catch((error) => {
        console.error("Seed failed:", error.message);
        db.end(() => process.exit(1));
    });
