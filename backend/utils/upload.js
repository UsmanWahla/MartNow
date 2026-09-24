const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Busboy = require("busboy");
const { corsHeaders, getPath, getRequestBody } = require("./http");
const { ServiceError } = require("./errors");

const UPLOAD_ROOT = path.join(__dirname, "..", "uploads");
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 8;
const ALLOWED_TYPES = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp"
};
const MIME_BY_EXT = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp"
};

function parseProductForm(req, tenantId) {
    const contentType = String(req.headers["content-type"] || "");

    if (!contentType.includes("multipart/form-data")) {
        return getRequestBody(req);
    }

    return new Promise((resolve, reject) => {
        let settled = false;
        let finished = false;
        let pendingFiles = 0;
        const fields = {};
        const imagePaths = [];

        function fail(error) {
            if (settled) {
                return;
            }

            settled = true;
            reject(error);
        }

        function tryDone() {
            if (settled || !finished || pendingFiles > 0) {
                return;
            }

            settled = true;

            if (imagePaths.length > 0) {
                fields.image_path = imagePaths[0];
                fields.image_paths = imagePaths;
            }

            resolve(fields);
        }

        const busboy = Busboy({
            headers: req.headers,
            limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_FILES }
        });

        busboy.on("file", (name, file, info) => {
            if (name !== "image" && name !== "images") {
                file.resume();
                return;
            }

            const mime = String(info.mimeType || info.mime || "").toLowerCase();
            const ext = ALLOWED_TYPES[mime];

            if (!ext) {
                file.resume();
                fail(new ServiceError(400, "Image must be jpg, png, or webp"));
                return;
            }

            const dir = path.join(UPLOAD_ROOT, "products", String(tenantId));
            fs.mkdirSync(dir, { recursive: true });
            const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
            const dest = path.join(dir, filename);
            const out = fs.createWriteStream(dest);
            let limited = false;
            pendingFiles += 1;

            file.on("limit", () => {
                limited = true;
            });

            file.pipe(out);
            out.on("close", () => {
                pendingFiles -= 1;

                if (limited) {
                    fs.unlink(dest, () => undefined);
                    fail(new ServiceError(400, "Image must be under 2MB"));
                    return;
                }

                imagePaths.push(`/uploads/products/${tenantId}/${filename}`);
                tryDone();
            });
            out.on("error", fail);
        });

        busboy.on("field", (name, value) => {
            fields[name] = value;
        });

        busboy.on("error", fail);
        busboy.on("finish", () => {
            finished = true;
            tryDone();
        });
        busboy.on("close", () => {
            finished = true;
            tryDone();
        });
        req.pipe(busboy);
    });
}

function handleUploads(req, res) {
    if (req.method !== "GET") {
        return false;
    }

    const urlPath = getPath(req.url);

    if (!urlPath.startsWith("/uploads/")) {
        return false;
    }

    const relative = path.normalize(urlPath.replace(/^\/+/, ""));

    if (relative.includes("..") || !relative.startsWith("uploads")) {
        res.writeHead(403, corsHeaders(req));
        res.end();
        return true;
    }

    const filePath = path.join(__dirname, "..", relative);
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_BY_EXT[ext];

    if (!mime) {
        res.writeHead(404, corsHeaders(req));
        res.end();
        return true;
    }

    fs.stat(filePath, (error, stat) => {
        if (error || !stat.isFile()) {
            res.writeHead(404, corsHeaders(req));
            res.end();
            return;
        }

        res.writeHead(200, {
            "Content-Type": mime,
            "Content-Length": stat.size,
            "Cache-Control": "public, max-age=86400",
            ...corsHeaders(req)
        });
        fs.createReadStream(filePath).pipe(res);
    });

    return true;
}

function parseStoreForm(req) {
    const contentType = String(req.headers["content-type"] || "");

    if (!contentType.includes("multipart/form-data")) {
        return getRequestBody(req);
    }

    return new Promise((resolve, reject) => {
        let settled = false;
        let finished = false;
        let pendingFiles = 0;
        const fields = {};
        let logoPath = "";

        function fail(error) {
            if (settled) {
                return;
            }

            settled = true;
            reject(error);
        }

        function tryDone() {
            if (settled || !finished || pendingFiles > 0) {
                return;
            }

            settled = true;

            if (logoPath) {
                fields.logo_path = logoPath;
            }

            resolve(fields);
        }

        const busboy = Busboy({
            headers: req.headers,
            limits: { fileSize: MAX_IMAGE_BYTES, files: 1 }
        });

        busboy.on("file", (name, file, info) => {
            if (name !== "logo" && name !== "image") {
                file.resume();
                return;
            }

            const mime = String(info.mimeType || info.mime || "").toLowerCase();
            const ext = ALLOWED_TYPES[mime];

            if (!ext) {
                file.resume();
                fail(new ServiceError(400, "Image must be jpg, png, or webp"));
                return;
            }

            const dir = path.join(UPLOAD_ROOT, "stores");
            fs.mkdirSync(dir, { recursive: true });
            const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
            const dest = path.join(dir, filename);
            const out = fs.createWriteStream(dest);
            let limited = false;
            pendingFiles += 1;

            file.on("limit", () => {
                limited = true;
            });

            file.pipe(out);
            out.on("close", () => {
                pendingFiles -= 1;

                if (limited) {
                    fs.unlink(dest, () => undefined);
                    fail(new ServiceError(400, "Image must be under 2MB"));
                    return;
                }

                logoPath = `/uploads/stores/${filename}`;
                tryDone();
            });
            out.on("error", fail);
        });

        busboy.on("field", (name, value) => {
            fields[name] = value;
        });

        busboy.on("error", fail);
        busboy.on("finish", () => {
            finished = true;
            tryDone();
        });
        busboy.on("close", () => {
            finished = true;
            tryDone();
        });
        req.pipe(busboy);
    });
}

module.exports = { parseProductForm, parseStoreForm, handleUploads, UPLOAD_ROOT };
