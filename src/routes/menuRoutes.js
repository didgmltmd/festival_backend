const express = require("express");
const router = express.Router();
const menuController = require("../controllers/menuController");

router.get("/", menuController.getMenuItems);
router.post("/", menuController.addMenuItem);
router.put("/:index", menuController.updateMenuItem);
router.delete("/:index", menuController.deleteMenuItem);

module.exports = router;
