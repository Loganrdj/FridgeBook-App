// Sign-in tokens for the iPhone app. The app sends its token as
// "Authorization: Bearer ..."; only a hash of it is stored here.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("MobileTokens", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      token_hash: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      UserId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onDelete: "CASCADE"
      },
      device_name: { type: Sequelize.STRING(80), allowNull: true },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      last_used_at: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
    await queryInterface.addIndex("MobileTokens", ["UserId"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("MobileTokens");
  }
};
