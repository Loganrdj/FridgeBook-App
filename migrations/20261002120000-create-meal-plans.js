// Recipes planned onto a calendar day
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("MealPlans", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      title: { type: Sequelize.STRING(100), allowNull: false },
      // { description, minutes, servings, ingredients: [{ name, amount }], steps: [] }
      recipe: { type: Sequelize.JSON, allowNull: false },
      // ingredient names the user said they already have for this meal
      dismissed: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
      UserId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      }
    });
    await queryInterface.addIndex("MealPlans", ["UserId", "date"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("MealPlans");
  }
};
