// Celiac Mode: per-user settings, gluten labels on kitchen items, and a shared
// cache of product checks (by barcode)
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Users", "celiac_mode", { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });
    await queryInterface.addColumn("Users", "celiac_strict", { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });

    // contains | may_contain | gluten_free | unknown; null = not checked yet
    await queryInterface.addColumn("Foods", "gluten_status", { type: Sequelize.STRING(16), allowNull: true });
    await queryInterface.addColumn("Foods", "gluten_reason", { type: Sequelize.STRING(200), allowNull: true });

    await queryInterface.createTable("ProductChecks", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      barcode: { type: Sequelize.STRING(20), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(200), allowNull: true },
      brand: { type: Sequelize.STRING(120), allowNull: true },
      status: { type: Sequelize.STRING(16), allowNull: false },
      reason: { type: Sequelize.STRING(400), allowNull: true },
      confidence: { type: Sequelize.STRING(8), allowNull: true },
      sources: { type: Sequelize.JSON, allowNull: false, defaultValue: [] },
      checked_at: { type: Sequelize.DATE, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("ProductChecks");
    await queryInterface.removeColumn("Foods", "gluten_reason");
    await queryInterface.removeColumn("Foods", "gluten_status");
    await queryInterface.removeColumn("Users", "celiac_strict");
    await queryInterface.removeColumn("Users", "celiac_mode");
  }
};
