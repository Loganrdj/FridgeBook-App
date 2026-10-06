// Shared cache: a restaurant's menu and what the web says about its kitchen
module.exports = function (sequelize, DataTypes) {
    return sequelize.define("RestaurantChecks", {
        key: { type: DataTypes.STRING(40), allowNull: false, unique: true },
        name: { type: DataTypes.STRING(160), allowNull: false },
        location: { type: DataTypes.STRING(200), allowNull: true },
        menu_url: { type: DataTypes.STRING(500), allowNull: true },
        dishes: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
        cross_contact: { type: DataTypes.JSON, allowNull: false },
        sources: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
        checked_at: { type: DataTypes.DATE, allowNull: false }
    });
};
