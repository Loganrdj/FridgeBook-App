module.exports = function (sequelize, DataTypes) {
    var ShoppingItems = sequelize.define("ShoppingItems", {
        name: { type: DataTypes.STRING(100), allowNull: false },
        quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, validate: { min: 1 } },
        note: { type: DataTypes.STRING(100), allowNull: true },
        checked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        source: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "manual" }
    }, {
        indexes: [{ fields: ["UserId"] }]
    });

    ShoppingItems.associate = function (models) {
        ShoppingItems.belongsTo(models.Users, { foreignKey: { allowNull: false } });
    };

    return ShoppingItems;
};
