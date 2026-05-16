const express = require("express");
const router = express.Router();
const { getZoneOrders, completeCooking } = require("../controllers/kitchenController");

router.get("/:zone", getZoneOrders);
router.patch("/:timestamp/:itemIndex/cook", completeCooking);
router.patch("/:timestamp/:itemIndex/serve", completeCooking);

module.exports = router;
