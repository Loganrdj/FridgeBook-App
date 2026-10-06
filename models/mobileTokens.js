// A signed-in iPhone app. Only a hash of the token is kept.
module.exports = function (sequelize, DataTypes) {
    return sequelize.define("MobileTokens", {
        token_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
        UserId: { type: DataTypes.INTEGER, allowNull: false },
        device_name: { type: DataTypes.STRING(80), allowNull: true },
        expires_at: { type: DataTypes.DATE, allowNull: false },
        last_used_at: { type: DataTypes.DATE, allowNull: true }
    });
};
