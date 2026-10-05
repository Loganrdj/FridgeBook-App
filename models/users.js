module.exports = function (sequelize, DataTypes) {
    var Users = sequelize.define("Users", {
        name: { type: DataTypes.STRING, allowNull: false },
        googleID: { type: DataTypes.STRING, allowNull: true },
        celiac_mode: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        celiac_strict: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
    });
    Users.associate = function(models){
        Users.hasMany(models.Foods,{
            onDelete:"cascade"
        });
        Users.hasMany(models.ShoppingItems,{
            onDelete:"cascade"
        });
        Users.hasMany(models.AiUsages,{
            onDelete:"cascade"
        });
        Users.hasMany(models.MealPlans,{
            onDelete:"cascade"
        });
    }
    return Users;
};