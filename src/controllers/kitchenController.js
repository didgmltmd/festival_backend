const { all, get, run } = require("../db");

const kitchenZones = ["A", "B", "C"];
const now = () => new Date().toISOString();

const isZone = (zone) => kitchenZones.includes(zone);

const statusWhere = (status) => {
  if (status === "cooking") return ["order_items.status = 'cooking'", []];
  if (status === "ready") return ["order_items.status = 'ready'", []];
  if (status === "served" || status === "completed") return ["order_items.status = 'served'", []];
  return ["order_items.status IN ('cooking', 'ready')", []];
};

exports.getZoneOrders = (req, res) => {
  const zone = req.params.zone.toUpperCase();
  const status = req.query.status || "active";

  if (!isZone(zone)) {
    return res.status(400).json({ error: "존재하지 않는 조리 구역입니다." });
  }

  const [where] = statusWhere(status);
  const result = all(
    `
      SELECT
        order_timestamp AS timestamp,
        item_index AS itemIndex,
        table_number AS tableNumber,
        name,
        quantity,
        order_items.status AS status,
        ordered_at AS orderedAt,
        cooked_at AS cookedAt,
        served_at AS servedAt
      FROM order_items
      JOIN orders ON orders.timestamp = order_items.order_timestamp
      WHERE zone = ? AND ${where}
      ORDER BY datetime(order_timestamp) ASC, item_index ASC
    `,
    [zone]
  );

  res.json(result);
};

exports.completeCooking = (req, res) => {
  const { timestamp, itemIndex } = req.params;
  const index = Number(itemIndex);
  const item = get("SELECT * FROM order_items WHERE order_timestamp = ? AND item_index = ?", [timestamp, index]);

  if (!item) return res.status(404).json({ error: "주문 항목을 찾을 수 없습니다." });
  if (!isZone(item.zone)) return res.status(400).json({ error: "조리 구역 항목이 아닙니다." });

  const cookedAt = now();
  run(
    "UPDATE order_items SET status = 'ready', cooked_at = ? WHERE order_timestamp = ? AND item_index = ? AND status = 'cooking'",
    [cookedAt, timestamp, index]
  );

  const payload = {
    zone: item.zone,
    timestamp,
    itemIndex: index,
    tableNumber: get("SELECT table_number FROM orders WHERE timestamp = ?", [timestamp]).table_number,
    name: item.name,
    quantity: item.quantity,
    status: "ready",
    orderedAt: item.ordered_at,
    cookedAt,
  };

  const io = req.app.get("io");
  io.emit("orderCooked", payload);
  io.emit("orderUpdated", { timestamp });

  res.json({ success: true, item: payload });
};
