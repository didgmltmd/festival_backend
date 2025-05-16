const express = require("express");
const cors = require("cors");
const app = express();
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const path = require("path");

// Swagger 문서 로드
const swaggerDocument = YAML.load(path.join(__dirname, "swagger", "swagger.yaml"));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// CORS 설정
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Body 파싱
app.use(express.json());

// 라우트 로드
const menuRoutes = require("./routes/menuRoutes");
const orderRoutes = require("./routes/orderRoutes");
const salesRoutes = require("./routes/salesRoutes");
const kitchenRoutes = require("./routes/kitchenRoutes");

app.use("/api/kitchen", kitchenRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);

// 서버 실행
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
});