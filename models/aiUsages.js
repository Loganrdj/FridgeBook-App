module.exports = function (sequelize, DataTypes) {
    var AiUsages = sequelize.define("AiUsages", {
        kind: { type: DataTypes.STRING(20), allowNull: false },
        day: { type: DataTypes.DATEONLY, allowNull: false },
        count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
    });

    AiUsages.associate = function (models) {
        AiUsages.belongsTo(models.Users, { foreignKey: { allowNull: false } });
    };

    return AiUsages;
};
