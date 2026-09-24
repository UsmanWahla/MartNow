const http = require("http");
require("dotenv").config();

const { sendJSON, sendCorsOptions, getPath } = require("./utils/http");
const { ServiceError } = require("./utils/errors");
const handleAuthRoutes = require("./routes/auth");
const handleDashboardRoutes = require("./routes/dashboard");
const handleProductRoutes = require("./routes/products");
const handleSaleRoutes = require("./routes/sales");
const handleStockRoutes = require("./routes/stock");
const handleStaffRoutes = require("./routes/staff");
const handleCustomerRoutes = require("./routes/customers");
const handleSupplierRoutes = require("./routes/suppliers");
const handleExpenseRoutes = require("./routes/expenses");
const handleSettingsRoutes = require("./routes/settings");
const handleProfileRoutes = require("./routes/profile");
const handleShopRoutes = require("./routes/shop");
const handleOrderRoutes = require("./routes/orders");
const handleSuperRoutes = require("./routes/super");
const handleMarketplaceRoutes = require("./routes/customer");
const { handleUploads } = require("./utils/upload");

const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is missing in .env");
    process.exit(1);
}

require("./db");

const server = http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
        sendCorsOptions(req, res);
        return;
    }

    if (req.method === "GET" && getPath(req.url) === "/") {
        sendJSON(req, res, 200, {
            message: "Node.js backend is running"
        });
        return;
    }

    if (handleUploads(req, res)) {
        return;
    }

    try {
        if (await handleAuthRoutes(req, res)) {
            return;
        }

        if (await handleMarketplaceRoutes(req, res)) {
            return;
        }

        if (await handleSuperRoutes(req, res)) {
            return;
        }

        if (await handleShopRoutes(req, res)) {
            return;
        }

        if (await handleOrderRoutes(req, res)) {
            return;
        }

        if (await handleDashboardRoutes(req, res)) {
            return;
        }

        if (await handleProductRoutes(req, res)) {
            return;
        }

        if (await handleSaleRoutes(req, res)) {
            return;
        }

        if (await handleStockRoutes(req, res)) {
            return;
        }

        if (await handleStaffRoutes(req, res)) {
            return;
        }

        if (await handleCustomerRoutes(req, res)) {
            return;
        }

        if (await handleSupplierRoutes(req, res)) {
            return;
        }

        if (await handleExpenseRoutes(req, res)) {
            return;
        }

        if (await handleSettingsRoutes(req, res)) {
            return;
        }

        if (await handleProfileRoutes(req, res)) {
            return;
        }

        if (!getPath(req.url).startsWith("/api")) {
            sendJSON(req, res, 404, {
                message: "This is the API server. Open the app at http://localhost:5173"
            });
            return;
        }

        sendJSON(req, res, 404, {
            message: "Route not found"
        });
    } catch (error) {
        if (error instanceof ServiceError) {
            sendJSON(req, res, error.status, {
                message: error.message
            });
            return;
        }

        if (error.message === "Invalid JSON" || error.message === "Request body too large") {
            sendJSON(req, res, 400, {
                message: "Invalid request"
            });
            return;
        }

        console.error(error);
        sendJSON(req, res, 500, {
            message: "Server error"
        });
    }
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
