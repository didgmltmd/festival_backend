const fs = require("fs");
const path = require("path");

const orderFilePath = path.join(__dirname, "../data/orders.json");
const menuFilePath = path.join(__dirname, "../data/menuItems.json");

const loadOrders = () => {
  if (!fs.existsSync(orderFilePath)) {
    fs.writeFileSync(orderFilePath, JSON.stringify([]));
  }
  return JSON.parse(fs.readFileSync(orderFilePath, "utf-8"));
};

const saveOrders = (orders) => {
  fs.writeFileSync(orderFilePath, JSON.stringify(orders, null, 2));
};

const loadMenuItems = () => {
  return JSON.parse(fs.readFileSync(menuFilePath, "utf-8"));
};

const saveKitchenZoneOrder = (zone, items) => {
  const filePath = path.join(__dirname, `../data/kitchen_${zone}.json`);
  let existing = [];

  if (fs.existsSync(filePath)) {
    try {
      existing = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (err) {
      console.error(`❌ kitchen_${zone}.json 파싱 오류:`, err);
    }
  }

  const updated = [...existing, ...items];
  fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
};

exports.createOrder = (req, res) => {
  const { tableNumber, items } = req.body;
  const menu = loadMenuItems();

  let totalPrice = 0;
  const enrichedItems = [];

  for (const item of items) {
    const menuItem = menu.find((m) => m.name === item.name);
    if (!menuItem) {
      return res.status(400).json({ error: `메뉴 ${item.name} 없음` });
    }

    const itemTotal = menuItem.price * item.quantity;
    totalPrice += itemTotal;

    enrichedItems.push({
      name: menuItem.name,
      price: menuItem.price,
      quantity: item.quantity,
      zone: menuItem.zone,
      total: itemTotal,
    });
  }

  const orderData = {
    tableNumber,
    items: enrichedItems,
    totalPrice,
    timestamp: new Date().toISOString(),
  };

  res.json(orderData);
};

exports.saveOrder = (req, res) => {
  const newOrder = req.body;

  try {
    const orders = loadOrders();
    const orderWithServeStatus = { ...newOrder, served: false };
    orders.push(orderWithServeStatus);
    saveOrders(orders);

    const zoneGroups = { A: [], B: [], C: [] };

    orderWithServeStatus.items.forEach((item, idx) => {
      zoneGroups[item.zone]?.push({
        timestamp: orderWithServeStatus.timestamp,
        itemIndex: idx,
        tableNumber: orderWithServeStatus.tableNumber,
        name: item.name,
        quantity: item.quantity,
      });
    });

    Object.entries(zoneGroups).forEach(([zone, items]) => {
      if (items.length > 0) {
        saveKitchenZoneOrder(zone, items);
        req.io.emit(`order:${zone}`, items);
      }
    });

    res.json({ success: true, message: "주문이 저장되었습니다." });
  } catch (err) {
    console.error("주문 저장 오류:", err);
    res.status(500).json({ error: "주문 저장에 실패했습니다." });
  }
};

exports.getOrders = (req, res) => {
  const orders = loadOrders();
  const sorted = orders.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  res.json(sorted);
};

exports.markOrderAsServed = (req, res) => {
  const { timestamp } = req.params;
  const orders = loadOrders();

  const order = orders.find((o) => o.timestamp === timestamp);
  if (!order) return res.status(404).json({ error: "주문을 찾을 수 없습니다." });

  order.items.forEach((item) => (item.served = true));
  order.served = true;
  saveOrders(orders);

  const io = req.app.get("io");
  io.emit("orderServed", {
    zone: "ALL",
    timestamp,
    itemIndexes: order.items.map((_, i) => i),
  });

  res.json({ success: true, message: "전체 서빙 완료됨" });
};

exports.markItemAsServed = (req, res) => {
  const { timestamp, itemIndex } = req.params;
  const orders = loadOrders();
  const order = orders.find((o) => o.timestamp === timestamp);
  if (!order) return res.status(404).json({ error: "주문을 찾을 수 없습니다." });

  const index = parseInt(itemIndex);
  if (!order.items[index]) return res.status(404).json({ error: "항목이 존재하지 않습니다." });

  order.items[index].served = true;
  order.served = order.items.every((item) => item.served);
  saveOrders(orders);

  const io = req.app.get("io");
  io.emit("orderServed", {
    zone: order.items[index].zone,
    timestamp,
    itemIndex: index,
  });

  res.json({ success: true, message: "서빙 완료 처리됨" });
};

exports.deleteOrder = (req, res) => {
  const { timestamp } = req.params;
  const orders = loadOrders();

  const targetOrder = orders.find((order) => order.timestamp === timestamp);
  if (!targetOrder) {
    return res.status(404).json({ error: "해당 주문이 존재하지 않습니다." });
  }

  const updatedOrders = orders.filter((order) => order.timestamp !== timestamp);
  saveOrders(updatedOrders);

  const io = req.app.get("io");
  const itemIndexes = targetOrder.items.map((_, idx) => idx);
  io.emit("orderDeleted", { timestamp, itemIndexes });

  console.log("🗑️ emit: orderDeleted", { timestamp, itemIndexes });
  res.json({ success: true, message: "주문이 삭제되었습니다." });
};