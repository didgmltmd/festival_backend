const express = require("express");
const router = express.Router();
const { getZoneOrders, serveItem } = require("../controllers/kitchenController");

router.get("/:zone", getZoneOrders);
router.patch("/:timestamp/:itemIndex/serve", serveItem); // ✅ 수정된 부분

module.exports = router;