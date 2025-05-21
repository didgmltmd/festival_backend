const express = require("express");
const router = express.Router();
const {
  saveDrunkOrder,
  updateDrinkingDelivered,
  getDrunkOrders,
  deleteAllDrunkOrders, // ✅ 추가
} = require("../controllers/drunkOrderController");

router.get("/", getDrunkOrders);                     // GET /api/drunk-orders
router.post("/", saveDrunkOrder);                    // POST /api/drunk-orders
router.patch("/:id/drinking-delivered", updateDrinkingDelivered); // PATCH /api/drunk-orders/:id/drinking-delivered
router.delete("/", deleteAllDrunkOrders);            // ✅ DELETE /api/drunk-orders

module.exports = router;
