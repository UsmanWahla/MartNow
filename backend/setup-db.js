const fs = require("fs");
const path = require("path");
const db = require("./db");
const { getStatements } = require("./utils/sqlFile");

function query(sql) {
    return new Promise((resolve, reject) => {
        db.query(sql, (error, results) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(results);
        });
    });
}

async function setup() {
    const sqlPath = path.join(__dirname, "sql", "simple-schema.sql");
    const sqlText = fs.readFileSync(sqlPath, "utf8");
    const statements = getStatements(sqlText);

    for (const statement of statements) {
        await query(statement);
    }

    const { migrate } = require("./migrate-business");
    await migrate();

    const [counts] = await query(`
        SELECT
            (SELECT COUNT(*) FROM products) AS products,
            (SELECT COUNT(*) FROM sales) AS sales
    `);

    console.log(`Database ready. Products: ${counts.products}, Sales: ${counts.sales}`);
}

setup()
    .then(() => {
        db.end();
    })
    .catch((error) => {
        console.error("Database setup failed:", error.message);
        db.end();
        process.exit(1);
    });
