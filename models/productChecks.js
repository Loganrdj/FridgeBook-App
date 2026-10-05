// Shared cache of gluten checks by barcode, so each product is researched once
module.exports = function (sequelize, DataTypes) {
    return sequelize.define("ProductChecks", {
        barcode: { type: DataTypes.STRING(20), allowNull: false, unique: true },
        name: { type: DataTypes.STRING(200), allowNull: true },
        brand: { type: DataTypes.STRING(120), allowNull: true },
        status: { type: DataTypes.STRING(16), allowNull: false },
        reason: { type: DataTypes.STRING(400), allowNull: true },
        confidence: { type: DataTypes.STRING(8), allowNull: true },
        sources: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
        checked_at: { type: DataTypes.DATE, allowNull: false }
    });
};
