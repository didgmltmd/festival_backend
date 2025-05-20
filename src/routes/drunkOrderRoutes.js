const express = require("express");
const router = express.Router();
const {
  saveDrunkOrder,
  updateDrinkingDelivered,
} = require("../controllers/drunkOrderController");

router.post("/", saveDrunkOrder); // POST /api/drunk-orders
router.patch("/:id/drinking-delivered", updateDrinkingDelivered); // PATCH

module.exports = router;
