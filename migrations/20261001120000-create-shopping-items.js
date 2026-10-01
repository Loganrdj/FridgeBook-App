// Per-user shopping list
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ShoppingItems", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      name: { type: Sequelize.STRING(100), allowNull: false },
      quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      // free-text amount from a recipe, e.g. "2 cups"
      note: { type: Sequelize.STRING(100), allowNull: true },
      checked: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      // where it came from: manual | kitchen | recipe
      source: { type: Sequelize.STRING(20), allowNull: false, defaultValue: "manual" },
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
    await queryInterface.addIndex("ShoppingItems", ["UserId"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("ShoppingItems");
  }
};
