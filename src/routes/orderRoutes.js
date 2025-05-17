const express = require("express");
const router = express.Router();

const {
  createOrder,
  saveOrder,
  getOrders,
  deleteOrder,
  markOrderAsServed,
  markItemAsServed,
} = require("../controllers/orderController");

router.post("/", createOrder);
router.post("/complete", saveOrder);
router.get("/", getOrders);
router.patch("/:timestamp/serve", markOrderAsServed);
router.patch("/:timestamp/:itemIndex/serve", markItemAsServed);
router.delete("/:timestamp", deleteOrder);

module.exports = router;
