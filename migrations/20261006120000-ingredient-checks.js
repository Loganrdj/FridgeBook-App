// A shared dictionary of ingredient gluten checks. When the rules can't decide
// and the AI answers, the answer is kept here so no one asks about that
// ingredient again for a while.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("IngredientChecks", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      // the ingredient name, simplified ("Organic Chicken Broths" -> "chicken broth")
      key: { type: Sequelize.STRING(80), allowNull: false, unique: true },
      status: { type: Sequelize.STRING(16), allowNull: false },
      reason: { type: Sequelize.STRING(200), allowNull: true },
      // how many times this entry saved an AI call
      hits: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      checked_at: { type: Sequelize.DATE, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("IngredientChecks");
  }
};
