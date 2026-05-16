const { db, getMenuItems, getOrders, get, run, refreshOrderServed } = require("../db");

const kitchenZones = ["A", "B", "C"];
const now = () => new Date().toISOString();

const enrichItems = (items) => {
  const menu = getMenuItems();
  let totalPrice = 0;

  const enriched = items.map((item) => {
    const menuItem = menu.find((entry) => entry.name === item.name || entry.id === item.id);
    const quantity = Number(item.quantity);

    if (!menuItem || !Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`메뉴를 확인할 수 없습니다: ${item.name || item.id}`);
    }

    const total = menuItem.price * quantity;
    totalPrice += total;
    return {
      name: menuItem.name,
      price: menuItem.price,
      quantity,
      zone: menuItem.zone,
      total,
    };
  });

  return { items: enriched, totalPrice };
};

exports.createOrder = (req, res) => {
  const { tableNumber, items } = req.body;

  if (!tableNumber || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "테이블 번호와 주문 항목이 필요합니다." });
  }

  try {
    const enriched = enrichItems(items);
    res.json({
      tableNumber,
      items: enriched.items,
      totalPrice: enriched.totalPrice,
      timestamp: now(),
      served: false,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.saveOrder = (req, res) => {
  const { tableNumber, items } = req.body;

  if (!tableNumber || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "테이블 번호와 주문 항목이 필요합니다." });
  }

  let enriched;
  try {
    enriched = enrichItems(items);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const timestamp = req.body.timestamp || now();
  const paidAt = req.body.paidAt || timestamp;
  const paymentMethod = req.body.paymentMethod || "현장결제";

  try {
    const insertOrder = db.prepare(`
      INSERT INTO orders (timestamp, table_number, total_price, payment_method, paid_at, served)
      VALUES (?, ?, ?, ?, ?, 0)
    `);
    const insertItem = db.prepare(`
      INSERT INTO order_items (
        order_timestamp, item_index, name, price, quantity, zone, total,
        status, ordered_at, cooked_at, served_at, served
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.exec("BEGIN");
    insertOrder.run(timestamp, String(tableNumber), enriched.totalPrice, paymentMethod, paidAt);

    enriched.items.forEach((item, index) => {
      const isCounter = item.zone === "COUNTER";
      insertItem.run(
        timestamp,
        index,
        item.name,
        item.price,
        item.quantity,
        item.zone,
        item.total,
        isCounter ? "served" : "cooking",
        timestamp,
        isCounter ? timestamp : null,
        isCounter ? timestamp : null,
        isCounter ? 1 : 0
      );
    });
    db.exec("COMMIT");

    const zoneGroups = { A: [], B: [], C: [] };
    enriched.items.forEach((item, index) => {
      if (kitchenZones.includes(item.zone)) {
        zoneGroups[item.zone].push({
          timestamp,
          itemIndex: index,
          tableNumber,
          name: item.name,
          quantity: item.quantity,
          status: "cooking",
          orderedAt: timestamp,
        });
      }
    });

    Object.entries(zoneGroups).forEach(([zone, zoneItems]) => {
      if (zoneItems.length > 0) req.io.emit(`order:${zone}`, zoneItems);
    });

    refreshOrderServed(timestamp);
    req.io.emit("orderCreated", { timestamp });
    res.status(201).json({ success: true, message: "주문이 저장되었습니다.", timestamp });
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {}
    console.error("Order save error:", err);
    res.status(500).json({ error: "주문 저장에 실패했습니다." });
  }
};

exports.getOrders = (req, res) => {
  res.json(
    getOrders({
      tableNumber: req.query.tableNumber,
      from: req.query.from,
      to: req.query.to,
    })
  );
};

exports.markOrderAsServed = (req, res) => {
  const { timestamp } = req.params;
  const order = get("SELECT timestamp FROM orders WHERE timestamp = ?", [timestamp]);

  if (!order) return res.status(404).json({ error: "주문을 찾을 수 없습니다." });

  const servedAt = now();
  run(
    "UPDATE order_items SET status = 'served', served = 1, served_at = COALESCE(served_at, ?), cooked_at = COALESCE(cooked_at, ?) WHERE order_timestamp = ?",
    [servedAt, servedAt, timestamp]
  );
  run("UPDATE orders SET served = 1 WHERE timestamp = ?", [timestamp]);

  req.app.get("io").emit("orderServed", { zone: "ALL", timestamp });
  req.app.get("io").emit("orderUpdated", { timestamp });
  res.json({ success: true, message: "전체 서빙 완료" });
};

exports.markItemAsServed = (req, res) => {
  const { timestamp, itemIndex } = req.params;
  const index = Number(itemIndex);
  const item = get("SELECT * FROM order_items WHERE order_timestamp = ? AND item_index = ?", [timestamp, index]);

  if (!item) return res.status(404).json({ error: "주문 항목을 찾을 수 없습니다." });

  const servedAt = now();
  run(
    "UPDATE order_items SET status = 'served', served = 1, served_at = ?, cooked_at = COALESCE(cooked_at, ?) WHERE order_timestamp = ? AND item_index = ?",
    [servedAt, servedAt, timestamp, index]
  );
  const completedItem = get("SELECT cooked_at, served_at FROM order_items WHERE order_timestamp = ? AND item_index = ?", [
    timestamp,
    index,
  ]);
  refreshOrderServed(timestamp);

  req.app.get("io").emit("orderServed", {
    zone: item.zone,
    timestamp,
    itemIndexes: [index],
    cookedAt: completedItem?.cooked_at || servedAt,
    servedAt: completedItem?.served_at || servedAt,
  });
  req.app.get("io").emit("orderUpdated", { timestamp });

  res.json({ success: true, message: "서빙 완료 처리됨" });
};

exports.deleteOrder = (req, res) => {
  const { timestamp } = req.params;
  const order = get("SELECT timestamp FROM orders WHERE timestamp = ?", [timestamp]);

  if (!order) return res.status(404).json({ error: "주문을 찾을 수 없습니다." });

  const items = getOrders().find((entry) => entry.timestamp === timestamp)?.items || [];
  run("DELETE FROM orders WHERE timestamp = ?", [timestamp]);

  req.app.get("io").emit("orderDeleted", {
    timestamp,
    itemIndexes: items.map((_, index) => index),
  });
  req.app.get("io").emit("orderUpdated", { timestamp });

  res.json({ success: true, message: "주문이 삭제되었습니다." });
};
