const fs = require("fs");
const path = require("path");
const menuFilePath = path.join(__dirname, "../data/menuItems.json");

// 전체 메뉴 불러오기 (index 포함)
exports.getMenuItems = (req, res) => {
  try {
    const menuItems = JSON.parse(fs.readFileSync(menuFilePath, "utf-8"));
    const itemsWithIndex = menuItems.map((item, index) => ({ ...item, index }));
    res.json(itemsWithIndex);
  } catch (err) {
    console.error("메뉴 불러오기 오류:", err);
    res.status(500).json({ error: "메뉴 데이터를 불러오지 못했습니다." });
  }
};

// 메뉴 항목 추가
exports.addMenuItem = (req, res) => {
  const { name, price, zone } = req.body;
  if (!name || !price || !zone) {
    return res.status(400).json({ error: "name, price, zone 모두 필요합니다." });
  }
  const menuItems = JSON.parse(fs.readFileSync(menuFilePath, "utf-8"));
  menuItems.push({ name, price, zone });
  fs.writeFileSync(menuFilePath, JSON.stringify(menuItems, null, 2));
  res.json({ success: true, message: "메뉴 추가됨." });
};

// 메뉴 항목 수정
exports.updateMenuItem = (req, res) => {
  const { index } = req.params;
  const { name, price, zone } = req.body;
  const menuItems = JSON.parse(fs.readFileSync(menuFilePath, "utf-8"));

  if (!menuItems[index]) return res.status(404).json({ error: "해당 항목이 존재하지 않음." });
  if (name) menuItems[index].name = name;
  if (price) menuItems[index].price = price;
  if (zone) menuItems[index].zone = zone;

  fs.writeFileSync(menuFilePath, JSON.stringify(menuItems, null, 2));
  res.json({ success: true, message: "메뉴 수정됨." });
};

// 메뉴 항목 삭제
exports.deleteMenuItem = (req, res) => {
  const { index } = req.params;
  const menuItems = JSON.parse(fs.readFileSync(menuFilePath, "utf-8"));

  if (!menuItems[index]) return res.status(404).json({ error: "해당 항목이 존재하지 않음." });
  menuItems.splice(index, 1);
  fs.writeFileSync(menuFilePath, JSON.stringify(menuItems, null, 2));
  res.json({ success: true, message: "메뉴 삭제됨." });
};
