const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const path = require("path");
require("./db");

const app = express();
const server = http.createServer(app);
const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";

const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  },
});

app.set("io", io);
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

const swaggerDocument = YAML.load(path.join(__dirname, "swagger", "swagger.yaml"));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

io.on("connection", (socket) => {
  console.log("WebSocket connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("WebSocket disconnected:", socket.id);
  });
});

app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use("/api/kitchen", require("./routes/kitchenRoutes"));
app.use("/api/sales", require("./routes/salesRoutes"));
app.use("/api/menu", require("./routes/menuRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));

app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "서버 내부 오류가 발생했습니다." });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
  console.log(`Swagger docs: http://localhost:${PORT}/api-docs`);
});
