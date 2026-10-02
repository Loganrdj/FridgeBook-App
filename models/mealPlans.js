module.exports = function (sequelize, DataTypes) {
    var MealPlans = sequelize.define("MealPlans", {
        date: { type: DataTypes.DATEONLY, allowNull: false },
        title: { type: DataTypes.STRING(100), allowNull: false },
        recipe: { type: DataTypes.JSON, allowNull: false },
        dismissed: { type: DataTypes.JSON, allowNull: false, defaultValue: [] }
    });

    MealPlans.associate = function (models) {
        MealPlans.belongsTo(models.Users, { foreignKey: { allowNull: false } });
    };

    return MealPlans;
};
