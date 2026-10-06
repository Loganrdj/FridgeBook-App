// Shared cache: the AI's gluten assessment of a dish (by name and description)
module.exports = function (sequelize, DataTypes) {
    return sequelize.define("DishChecks", {
        key: { type: DataTypes.STRING(40), allowNull: false, unique: true },
        name: { type: DataTypes.STRING(120), allowNull: false },
        description: { type: DataTypes.STRING(400), allowNull: true },
        gluten_chance: { type: DataTypes.INTEGER, allowNull: false },
        reason: { type: DataTypes.STRING(300), allowNull: true },
        sources: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
        questions: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
        checked_at: { type: DataTypes.DATE, allowNull: false }
    });
};
