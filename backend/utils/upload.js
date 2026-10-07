const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Busboy = require("busboy");
const { corsHeaders, getPath, getRequestBody } = require("./http");
const { ServiceError } = require("./errors");

const UPLOAD_ROOT = path.join(__dirname, "..", "uploads");
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 8;
const UPLOADED_FILES = Symbol("uploadedFiles");
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

async function fileMatchesMime(filePath, mime) {
    const handle = await fs.promises.open(filePath, "r");

    try {
        const header = Buffer.alloc(12);
        const { bytesRead } = await handle.read(header, 0, header.length, 0);

        if (mime === "image/jpeg" || mime === "image/jpg") {
            return bytesRead >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
        }

        if (mime === "image/png") {
            return bytesRead >= 8 && header.subarray(0, 8).equals(
                Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
            );
        }

        if (mime === "image/webp") {
            return bytesRead >= 12 &&
                header.subarray(0, 4).toString("ascii") === "RIFF" &&
                header.subarray(8, 12).toString("ascii") === "WEBP";
        }

        return false;
    } finally {
        await handle.close();
    }
}

function toUploadFilePath(uploadPath) {
    const value = String(uploadPath || "").trim().replace(/\\/g, "/");

    if (!value.startsWith("/uploads/")) {
        return null;
    }

    const root = path.resolve(UPLOAD_ROOT);
    const filePath = path.resolve(path.join(__dirname, "..", value.replace(/^\/+/, "")));

    if (filePath === root || !filePath.startsWith(root + path.sep)) {
        return null;
    }

    return filePath;
}

async function deleteUploadPaths(uploadPaths) {
    const filePaths = [...new Set((uploadPaths || []).map(toUploadFilePath).filter(Boolean))];

    await Promise.all(
        filePaths.map(async (filePath) => {
            try {
                await fs.promises.unlink(filePath);
            } catch (error) {
                if (error.code !== "ENOENT") {
                    console.error("Unable to remove upload:", error.message);
                }
            }
        })
    );
}

async function deleteTenantProductUploads(tenantId) {
    const id = Number(tenantId);

    if (!Number.isInteger(id) || id <= 0) {
        return;
    }

    const directory = path.resolve(UPLOAD_ROOT, "products", String(id));
    const productsRoot = path.resolve(UPLOAD_ROOT, "products");

    if (!directory.startsWith(productsRoot + path.sep)) {
        return;
    }

    try {
        await fs.promises.rm(directory, { recursive: true, force: true });
    } catch (error) {
        console.error("Unable to remove product uploads:", error.message);
    }
}

function getUploadedPaths(form) {
    return Array.isArray(form?.[UPLOADED_FILES]) ? [...form[UPLOADED_FILES]] : [];
}

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
        const createdFiles = new Set();

        function cleanupCreatedFiles() {
            for (const filePath of createdFiles) {
                fs.unlink(filePath, () => undefined);
            }
        }

        function fail(error) {
            if (settled) {
                return;
            }

            settled = true;
            cleanupCreatedFiles();
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

            Object.defineProperty(fields, UPLOADED_FILES, {
                value: [...imagePaths],
                enumerable: false
            });

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
            createdFiles.add(dest);

            file.on("limit", () => {
                limited = true;
            });

            file.pipe(out);
            out.on("close", async () => {
                if (settled) {
                    pendingFiles -= 1;
                    fs.unlink(dest, () => undefined);
                    return;
                }

                if (limited) {
                    pendingFiles -= 1;
                    fs.unlink(dest, () => undefined);
                    fail(new ServiceError(400, "Image must be under 2MB"));
                    return;
                }

                try {
                    if (!(await fileMatchesMime(dest, mime))) {
                        pendingFiles -= 1;
                        fs.unlink(dest, () => undefined);
                        fail(new ServiceError(400, "Image content does not match its file type"));
                        return;
                    }
                } catch (error) {
                    pendingFiles -= 1;
                    fail(error);
                    return;
                }

                pendingFiles -= 1;
                imagePaths.push(`/uploads/products/${tenantId}/${filename}`);
                tryDone();
            });
            out.on("error", fail);
        });

        busboy.on("field", (name, value) => {
            fields[name] = value;
        });

        busboy.on("error", fail);
        busboy.on("filesLimit", () => fail(new ServiceError(400, "A product can have up to 8 images")));
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

function parseStoreForm(
    req,
    { fileFields = ["logo", "image"], uploadFolder = "stores", resultField = "logo_path" } = {}
) {
    const contentType = String(req.headers["content-type"] || "");

    if (!contentType.includes("multipart/form-data")) {
        return getRequestBody(req);
    }

    return new Promise((resolve, reject) => {
        let settled = false;
        let finished = false;
        let pendingFiles = 0;
        const fields = {};
        let imagePath = "";
        const createdFiles = new Set();

        function cleanupCreatedFiles() {
            for (const filePath of createdFiles) {
                fs.unlink(filePath, () => undefined);
            }
        }

        function fail(error) {
            if (settled) {
                return;
            }

            settled = true;
            cleanupCreatedFiles();
            reject(error);
        }

        function tryDone() {
            if (settled || !finished || pendingFiles > 0) {
                return;
            }

            settled = true;

            if (imagePath) {
                fields[resultField] = imagePath;
            }

            Object.defineProperty(fields, UPLOADED_FILES, {
                value: imagePath ? [imagePath] : [],
                enumerable: false
            });

            resolve(fields);
        }

        const busboy = Busboy({
            headers: req.headers,
            limits: { fileSize: MAX_IMAGE_BYTES, files: 1 }
        });

        busboy.on("file", (name, file, info) => {
            if (!fileFields.includes(name)) {
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

            const dir = path.join(UPLOAD_ROOT, uploadFolder);
            fs.mkdirSync(dir, { recursive: true });
            const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
            const dest = path.join(dir, filename);
            const out = fs.createWriteStream(dest);
            let limited = false;
            pendingFiles += 1;
            createdFiles.add(dest);

            file.on("limit", () => {
                limited = true;
            });

            file.pipe(out);
            out.on("close", async () => {
                if (settled) {
                    pendingFiles -= 1;
                    fs.unlink(dest, () => undefined);
                    return;
                }

                if (limited) {
                    pendingFiles -= 1;
                    fs.unlink(dest, () => undefined);
                    fail(new ServiceError(400, "Image must be under 2MB"));
                    return;
                }

                try {
                    if (!(await fileMatchesMime(dest, mime))) {
                        pendingFiles -= 1;
                        fs.unlink(dest, () => undefined);
                        fail(new ServiceError(400, "Image content does not match its file type"));
                        return;
                    }
                } catch (error) {
                    pendingFiles -= 1;
                    fail(error);
                    return;
                }

                pendingFiles -= 1;
                imagePath = `/uploads/${uploadFolder}/${filename}`;
                tryDone();
            });
            out.on("error", fail);
        });

        busboy.on("field", (name, value) => {
            fields[name] = value;
        });

        busboy.on("error", fail);
        busboy.on("filesLimit", () => fail(new ServiceError(400, "Only one image can be uploaded")));
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

module.exports = {
    parseProductForm,
    parseStoreForm,
    handleUploads,
    deleteUploadPaths,
    deleteTenantProductUploads,
    getUploadedPaths,
    UPLOAD_ROOT
};
