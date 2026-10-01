// The schema as of 2026-10-01. Production already had these tables (created by
// sequelize.sync and scripts/recreate-foods-table.js), so each one is only
// created if it's missing.
async function tableExists(queryInterface, name) {
  const tables = await queryInterface.showAllTables();
  return tables.map((t) => (typeof t === "string" ? t : t.tableName)).includes(name);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "Users"))) {
      await queryInterface.createTable("Users", {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        name: { type: Sequelize.STRING, allowNull: false },
        googleID: { type: Sequelize.STRING, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false }
      });
    }

    if (!(await tableExists(queryInterface, "Foods"))) {
      await queryInterface.createTable("Foods", {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
        name: { type: Sequelize.STRING(100), allowNull: false },
        quantity: { type: Sequelize.INTEGER, allowNull: false },
        date_start: { type: Sequelize.DATEONLY, allowNull: false },
        date_expire: { type: Sequelize.DATEONLY, allowNull: false },
        fridge_bool: { type: Sequelize.BOOLEAN, allowNull: false },
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
      await queryInterface.addIndex("Foods", ["UserId"]);
    }

    // Login sessions (the table connect-pg-simple expects)
    if (!(await tableExists(queryInterface, "session"))) {
      await queryInterface.sequelize.query(`
        CREATE TABLE "session" (
          "sid" varchar NOT NULL COLLATE "default" PRIMARY KEY,
          "sess" json NOT NULL,
          "expire" timestamp(6) NOT NULL
        );
        CREATE INDEX "IDX_session_expire" ON "session" ("expire");
      `);
    }
  },

  async down() {
    // Undoing this would drop every table and all user data
    throw new Error("The baseline migration can't be undone.");
  }
};
