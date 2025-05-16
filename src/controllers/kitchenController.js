const fs = require("fs");
const path = require("path");

const orderFilePath = path.join(__dirname, "../data/orders.json");

// 1. 구역별 미서빙 항목 조회 (개별 음식 기준)
exports.getZoneOrders = (req, res) => {
  const zone = req.params.zone.toUpperCase();
  if (!["A", "B", "C"].includes(zone)) {
    return res.status(400).json({ error: "존재하지 않는 zone입니다. A, B, C 중 하나여야 합니다." });
  }

  if (!fs.existsSync(orderFilePath)) {
    return res.status(404).json({ error: "주문 내역이 없습니다." });
  }

  const orders = JSON.parse(fs.readFileSync(orderFilePath, "utf-8"));
  const result = [];

  for (const order of orders) {
    if (order.served) continue;

    order.items.forEach((item, index) => {
      if (item.zone === zone && item.served === false) {
        result.push({
          timestamp: order.timestamp,
          itemIndex: index,
          tableNumber: order.tableNumber,
          name: item.name,
          quantity: item.quantity,
        });
      }
    });
  }

  res.json(result);
};

// ✅ 2. 항목별 서빙 완료 처리
exports.serveItem = (req, res) => {
  const { timestamp, index } = req.params;
  const itemIndex = parseInt(index);
  const orders = JSON.parse(fs.readFileSync(orderFilePath, "utf-8"));

  const order = orders.find((o) => o.timestamp === timestamp);
  if (!order) return res.status(404).json({ error: "주문을 찾을 수 없습니다." });

  if (!order.items[itemIndex]) return res.status(404).json({ error: "해당 항목이 존재하지 않습니다." });

  order.items[itemIndex].served = true;

  // 전체 항목이 서빙 완료되었는지 확인
  const allServed = order.items.every((item) => item.served === true);
  if (allServed) order.served = true;

  fs.writeFileSync(orderFilePath, JSON.stringify(orders, null, 2));

  res.json({ success: true, message: "항목이 서빙 완료 처리되었습니다." });
};