module.exports = function (sequelize, DataTypes) {
    var Users = sequelize.define("Users", {
        name: { type: DataTypes.STRING, allowNull: false },
        googleID: { type: DataTypes.STRING, allowNull: true }
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