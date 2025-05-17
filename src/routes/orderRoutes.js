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

/**
 * @route POST /api/orders
 * @desc 주문서 계산 (총액 및 메뉴 정보 포함, 저장은 안 함)
 */
router.post("/", createOrder);

/**
 * @route POST /api/orders/complete
 * @desc 주문 저장 + served: false
 */
router.post("/complete", saveOrder);

/**
 * @route GET /api/orders
 * @desc 전체 주문 내역 조회 (시간순 정렬)
 */
router.get("/", getOrders);

/**
 * @route PATCH /api/orders/:timestamp/serve
 * @desc 주문 단위로 서빙 완료 처리 (주문 전체 항목이 완료된 경우만 served: true 처리됨)
 */
router.patch("/:timestamp/serve", markOrderAsServed);

/**
 * @route PATCH /api/orders/:timestamp/:itemIndex/serve
 * @desc 개별 항목 기준 서빙 완료 처리
 */
router.patch("/:timestamp/:itemIndex/serve", markItemAsServed);

/**
 * @route DELETE /api/orders/:timestamp
 * @desc 특정 주문 삭제 처리
 */
router.delete("/:timestamp", deleteOrder);

module.exports = router;
