const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "../data/drunkOrders.json");

const loadOrders = () => {
  if (!fs.existsSync(dataPath)) return [];
  const data = fs.readFileSync(dataPath, "utf-8");
  return JSON.parse(data);
};

const saveOrders = (orders) => {
  fs.writeFileSync(dataPath, JSON.stringify(orders, null, 2));
};

// POST /api/drunk-orders
exports.saveDrunkOrder = (req, res) => {
  try {
    const newOrder = {
      id: Date.now(), // 고유 ID (timestamp 기반)
      ...req.body,
      drinkingDelivered: false, // 술 전달 여부 초기값
    };

    const orders = loadOrders();
    orders.push(newOrder);
    saveOrders(orders);

    res.status(201).json({ success: true, order: newOrder });
  } catch (err) {
    console.error("주문 저장 실패:", err);
    res.status(500).json({ error: "주문 저장 실패" });
  }
};

// PATCH /api/drunk-orders/:id/drinking-delivered
exports.updateDrinkingDelivered = (req, res) => {
  try {
    const { id } = req.params;
    const { delivered } = req.body;

    const orders = loadOrders();
    const idx = orders.findIndex((order) => order.id == id);

    if (idx === -1) {
      return res.status(404).json({ error: "주문을 찾을 수 없습니다." });
    }

    orders[idx].drinkingDelivered = delivered;
    saveOrders(orders);

    res.json({ success: true, updatedOrder: orders[idx] });
  } catch (err) {
    console.error("상태 수정 실패:", err);
    res.status(500).json({ error: "상태 수정 실패" });
  }
};


// GET /api/drunk-orders
exports.getDrunkOrders = (req, res) => {
  try {
    const orders = loadOrders();
    res.status(200).json(orders);
  } catch (err) {
    console.error("술 주문 조회 실패:", err);
    res.status(500).json({ error: "술 주문 조회 실패" });
  }
};
