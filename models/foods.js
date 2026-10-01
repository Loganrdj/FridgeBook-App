module.exports = function (sequelize, DataTypes) {
    var Foods = sequelize.define("Foods", {
        name: { type: DataTypes.STRING(100), allowNull: false },
        quantity: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0 } },
        // Plain calendar dates ("YYYY-MM-DD"), so they don't shift with time zones
        date_start: { type: DataTypes.DATEONLY, allowNull: false },
        date_expire: { type: DataTypes.DATEONLY, allowNull: false },
        fridge_bool: { type: DataTypes.BOOLEAN, allowNull: false }
    }, {
        indexes: [{ fields: ["UserId"] }]
    });

    Foods.associate = function(models){
        Foods.belongsTo(models.Users,{
            foreignKey: {
                allowNull: false
            }
        })
    }

    return Foods;
};
