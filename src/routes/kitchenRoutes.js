const express = require("express");
const router = express.Router();
const { getZoneOrders, serveItem } = require("../controllers/kitchenController");

router.get("/:zone", getZoneOrders);
router.patch("/:timestamp/:index/serve", serveItem);

module.exports = router;