const fs = require("fs");
const path = require("path");

exports.getSalesSummary = (req, res) => {
  const filePath = path.join(__dirname, "../data/orders.json");

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "주문 내역이 없습니다." });
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const orders = JSON.parse(raw);

  const summary = {};

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const { name, quantity, total } = item;

      if (!summary[name]) {
        summary[name] = { name, totalSold: 0, totalRevenue: 0 };
      }

      summary[name].totalSold += quantity;
      summary[name].totalRevenue += total;
    });
  });

  const result = Object.values(summary);
  res.json(result);
};
