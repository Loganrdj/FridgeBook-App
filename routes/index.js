const router = require("express").Router();
const htmlRoutes = require("./htmlRoutes");
const authRoutes = require("./authRoutes");
const apiRoutes = require("./apiRoutes");
const shoppingRoutes = require("./shoppingRoutes");
const recipeRoutes = require("./recipeRoutes");
const mealRoutes = require("./mealRoutes");
const receiptRoutes = require("./receiptRoutes");
const settingsRoutes = require("./settingsRoutes");
const glutenRoutes = require("./glutenRoutes");
const diningRoutes = require("./diningRoutes");

router.use("/",htmlRoutes);
router.use("/auth",authRoutes);
router.use("/api/shopping",shoppingRoutes);
router.use("/api/recipes",recipeRoutes);
router.use("/api/meals",mealRoutes);
router.use("/api/receipts",receiptRoutes);
router.use("/api/me",settingsRoutes);
router.use("/api/gluten",diningRoutes);
router.use("/api/gluten",glutenRoutes);
router.use("/api",apiRoutes);

module.exports = router;