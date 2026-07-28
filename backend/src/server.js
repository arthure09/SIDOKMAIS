require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const authRoutes = require("./routes/auth.routes");
const pasienRoutes = require("./routes/pasien.routes");
const operasiRoutes = require("./routes/operasi.routes");
const notifikasiRoutes = require("./routes/notifikasi.routes");
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
// Notifikasi murni milik dokter — ADMIN tidak butuh akses ke sini.
app.use("/api/notifikasi", authenticate, authorize("DOKTER"), notifikasiRoutes);

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
