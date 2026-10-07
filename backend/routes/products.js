const {
    sendJSON,
    getPath,
    getNumericId,
    getQuery
} = require("../utils/http");
const { fromQuery } = require("../utils/list");
const { requireLogin, requireRole } = require("../middleware/auth");
const { parseProductForm, deleteUploadPaths, getUploadedPaths } = require("../utils/upload");
const { CATALOG } = require("../utils/roles");
const productService = require("../services/productService");

function productImagePaths(product) {
    return [...new Set([
        ...(product?.images || []).map((image) => image.path),
        product?.image_path
    ].filter(Boolean))];
}

async function handleProductRoutes(req, res) {
    const path = getPath(req.url);
    const ledgerMatch = path.match(/^\/api\/products\/(\d+)\/ledger$/);
    const productId = getNumericId(path, "/api/products");

    if (req.method === "GET" && ledgerMatch) {
        const auth = requireRole(req, res, CATALOG);

        if (!auth) {
            return true;
        }

        const ledger = await productService.getLedger(
            auth.tenantId,
            Number(ledgerMatch[1])
        );
        sendJSON(req, res, 200, ledger);
        return true;
    }

    if (req.method === "GET" && path === "/api/products") {
        const auth = requireLogin(req, res);

        if (!auth) {
            return true;
        }

        const products = await productService.listProducts(
            auth.tenantId,
            fromQuery(getQuery(req.url))
        );
        sendJSON(req, res, 200, products);
        return true;
    }

    if (req.method === "POST" && path === "/api/products") {
        const auth = requireRole(req, res, CATALOG);

        if (!auth) {
            return true;
        }

        const body = await parseProductForm(req, auth.tenantId);
        let result;

        try {
            result = await productService.addProduct(auth.tenantId, body, auth.id);
        } catch (error) {
            await deleteUploadPaths(getUploadedPaths(body));
            throw error;
        }

        sendJSON(req, res, 201, result);
        return true;
    }

    if (req.method === "PUT" && productId) {
        const auth = requireRole(req, res, CATALOG);

        if (!auth) {
            return true;
        }

        const existing = await productService.getProduct(auth.tenantId, productId);
        const body = await parseProductForm(req, auth.tenantId);
        let result;

        try {
            result = await productService.updateProduct(
                auth.tenantId,
                productId,
                body
            );
        } catch (error) {
            await deleteUploadPaths(getUploadedPaths(body));
            throw error;
        }

        const retained = new Set(productImagePaths(result.product));
        await deleteUploadPaths(productImagePaths(existing).filter((imagePath) => !retained.has(imagePath)));
        sendJSON(req, res, 200, result);
        return true;
    }

    if (req.method === "DELETE" && productId) {
        const auth = requireRole(req, res, CATALOG);

        if (!auth) {
            return true;
        }

        const existing = await productService.getProduct(auth.tenantId, productId);
        const result = await productService.deleteProduct(auth.tenantId, productId);
        await deleteUploadPaths(productImagePaths(existing));
        sendJSON(req, res, 200, result);
        return true;
    }

    return false;
}

module.exports = handleProductRoutes;
