const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  },
});

// io 객체를 app에 등록
app.set("io", io);

// Swagger 문서 로드
const swaggerDocument = YAML.load(path.join(__dirname, "swagger", "swagger.yaml"));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// CORS 설정
app.use(cors());
app.use(express.json());

// 소켓 연결
io.on("connection", (socket) => {
  console.log("✅ 클라이언트 WebSocket 연결됨");

  socket.on("disconnect", () => {
    console.log("❌ 클라이언트 연결 해제됨");
  });
});

app.use((req, res, next) => {
  req.io = io;
  next();
});

// 라우트 불러오기
const menuRoutes = require("./routes/menuRoutes");
const orderRoutes = require("./routes/orderRoutes");
const salesRoutes = require("./routes/salesRoutes");
const kitchenRoutes = require("./routes/kitchenRoutes");

// API 라우팅
app.use("/api/kitchen", kitchenRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);

// 에러 핸들링
app.use((err, req, res, next) => {
  console.error("서버 에러:", err.stack);
  res.status(500).json({ error: "서버 내부 오류 발생" });
});

// 서버 실행
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
  console.log(`📚 Swagger 문서: http://localhost:${PORT}/api-docs`);
});
