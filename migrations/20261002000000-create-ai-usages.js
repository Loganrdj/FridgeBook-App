// Per-user daily counts of AI requests (recipe searches, receipt scans), so the
// free Gemini quota is shared fairly
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("AiUsages", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      kind: { type: Sequelize.STRING(20), allowNull: false },
      day: { type: Sequelize.DATEONLY, allowNull: false },
      count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
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
    await queryInterface.addIndex("AiUsages", ["UserId", "kind", "day"], { unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("AiUsages");
  }
};
