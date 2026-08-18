require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const authRoutes = require("./routes/auth.routes");
const pasienRoutes = require("./routes/pasien.routes");
const operasiRoutes = require("./routes/operasi.routes");
const kunjunganRoutes = require("./routes/kunjungan.routes");
const konsultasiRoutes = require("./routes/konsultasi.routes");
const notifikasiRoutes = require("./routes/notifikasi.routes");
const labRoutes = require("./routes/lab.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const kalenderRoutes = require("./routes/kalender.routes");
const authenticate = require("./middleware/auth.middleware");
const authorize = require("./middleware/rbac.middleware");

const app = express();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/pasien", authenticate, authorize("DOKTER", "ADMIN"), pasienRoutes);
app.use("/api/operasi", authenticate, authorize("DOKTER", "ADMIN"), operasiRoutes);
app.use("/api/kunjungan", authenticate, authorize("DOKTER", "ADMIN"), kunjunganRoutes);
app.use("/api/konsultasi", authenticate, authorize("DOKTER", "ADMIN"), konsultasiRoutes);
app.use("/api/notifikasi", authenticate, authorize("DOKTER", "ADMIN"), notifikasiRoutes);
app.use("/api/lab", authenticate, authorize("DOKTER", "ADMIN"), labRoutes);
app.use("/api/dashboard", authenticate, authorize("DOKTER", "ADMIN"), dashboardRoutes);
app.use("/api/kalender", authenticate, authorize("DOKTER", "ADMIN"), kalenderRoutes);

// Endpoint uji coba RBAC (bukan endpoint produksi) — echo req.user apa
// adanya untuk verifikasi visual bahwa authenticate + authorize sudah benar.
app.get("/api/me", authenticate, authorize("DOKTER", "ADMIN"), (req, res) => {
  res.json(req.user);
});

app.use((req, res) => {
  res.status(404).json({ message: "Route tidak ditemukan" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Terjadi kesalahan pada server" });
});

const PORT = process.env.PORT || 3000;

// Hanya listen kalau file ini dijalankan langsung (node src/server.js),
// bukan saat di-require oleh test (Jest + Supertest).
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`SIDOKMAIS backend berjalan di port ${PORT}`);
  });
}

module.exports = app;
