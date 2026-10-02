const router = require("express").Router();
const htmlRoutes = require("./htmlRoutes");
const authRoutes = require("./authRoutes");
const apiRoutes = require("./apiRoutes");
const shoppingRoutes = require("./shoppingRoutes");
const recipeRoutes = require("./recipeRoutes");

router.use("/",htmlRoutes);
router.use("/auth",authRoutes);
router.use("/api/shopping",shoppingRoutes);
router.use("/api/recipes",recipeRoutes);
router.use("/api",apiRoutes);

module.exports = router;