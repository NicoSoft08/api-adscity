// Helper function to convert camelCase to snake_case for PostgreSQL column names
const snakeCaseKey = (key) => {
    return key.replace(/([A-Z])/g, '_$1').toLowerCase();
}

module.exports = {
    snakeCaseKey,
};