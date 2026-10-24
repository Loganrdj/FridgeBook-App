// Gluten checks for restaurant dishes, shared by everyone so each dish, recipe
// cross-check and restaurant is researched once:
// - DishChecks: the AI assessment of one dish (by name and menu description)
// - RecipeStats: how many published recipes for a dish use gluten ingredients
// - RestaurantChecks: a restaurant's menu and what the web says about its kitchen
module.exports = {
  async up(queryInterface, Sequelize) {
    const timestamps = {
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    };

    await queryInterface.createTable("DishChecks", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      key: { type: Sequelize.STRING(40), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(120), allowNull: false },
      description: { type: Sequelize.STRING(400), allowNull: true },
      gluten_chance: { type: Sequelize.INTEGER, allowNull: false },
      reason: { type: Sequelize.STRING(300), allowNull: true },
      sources: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
      questions: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
      checked_at: { type: Sequelize.DATE, allowNull: false },
      ...timestamps
    });

    await queryInterface.createTable("RecipeStats", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      dish: { type: Sequelize.STRING(120), allowNull: false, unique: true },
      checked: { type: Sequelize.INTEGER, allowNull: false },
      with_gluten: { type: Sequelize.INTEGER, allowNull: false },
      examples: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
      checked_at: { type: Sequelize.DATE, allowNull: false },
      ...timestamps
    });

    await queryInterface.createTable("RestaurantChecks", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      key: { type: Sequelize.STRING(40), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(160), allowNull: false },
      location: { type: Sequelize.STRING(200), allowNull: true },
      menu_url: { type: Sequelize.STRING(500), allowNull: true },
      dishes: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
      cross_contact: { type: Sequelize.JSON, allowNull: false },
      sources: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
      checked_at: { type: Sequelize.DATE, allowNull: false },
      ...timestamps
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("RestaurantChecks");
    await queryInterface.dropTable("RecipeStats");
    await queryInterface.dropTable("DishChecks");
  }
};
