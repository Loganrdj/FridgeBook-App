// Shared dictionary: what the AI said about an ingredient's gluten, by simplified name
module.exports = function (sequelize, DataTypes) {
    return sequelize.define("IngredientChecks", {
        key: { type: DataTypes.STRING(80), allowNull: false, unique: true },
        status: { type: DataTypes.STRING(16), allowNull: false },
        reason: { type: DataTypes.STRING(200), allowNull: true },
        hits: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        checked_at: { type: DataTypes.DATE, allowNull: false }
    });
};
