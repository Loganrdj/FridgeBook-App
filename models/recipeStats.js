// Shared cache: how many published recipes for a dish use gluten ingredients.
// Only counts, titles and links are kept (Spoonacular's terms allow those).
module.exports = function (sequelize, DataTypes) {
    return sequelize.define("RecipeStats", {
        dish: { type: DataTypes.STRING(120), allowNull: false, unique: true },
        checked: { type: DataTypes.INTEGER, allowNull: false },
        with_gluten: { type: DataTypes.INTEGER, allowNull: false },
        examples: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
        checked_at: { type: DataTypes.DATE, allowNull: false }
    });
};
