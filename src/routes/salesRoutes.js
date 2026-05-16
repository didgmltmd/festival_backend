const express = require("express");
const router = express.Router();
const {
  getSalesSummary,
  getSalesSnapshots,
  resetSalesData,
} = require("../controllers/salesController");

router.get("/summary", getSalesSummary);
router.get("/snapshots", getSalesSnapshots);
router.post("/reset", resetSalesData);

module.exports = router;
