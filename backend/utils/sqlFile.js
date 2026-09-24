function getStatements(sqlText) {
    return sqlText
        .split(";")
        .map((statement) =>
            statement
                .split("\n")
                .map((line) => line.trim())
                .filter((line) => line && !line.startsWith("--"))
                .join("\n")
                .trim()
        )
        .filter((statement) => statement);
}

module.exports = { getStatements };
