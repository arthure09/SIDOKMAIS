require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
// routes/bersama/ — tidak terpengaruh SUMBER_DATA, selalu ke PostgreSQL.
const authRoutes = require("./routes/bersama/auth.routes");
const notifikasiRoutes = require("./routes/bersama/notifikasi.routes");
const kalenderRoutes = require("./routes/bersama/kalender.routes");

// routes/dummy/ — pasangan PostgreSQL untuk tiap modul di routes/simrs/.
const pasienRoutes = require("./routes/dummy/pasien.routes");
const operasiRoutes = require("./routes/dummy/operasi.routes");
const kunjunganRoutes = require("./routes/dummy/kunjungan.routes");
const konsultasiRoutes = require("./routes/dummy/konsultasi.routes");
const labRoutes = require("./routes/dummy/lab.routes");
const radiologiRoutes = require("./routes/dummy/radiologi.routes");
const dashboardRoutes = require("./routes/dummy/dashboard.routes");
const pendapatanRoutes = require("./routes/dummy/pendapatan.routes");
const authenticate = require("./middleware/auth.middleware");
const authorize = require("./middleware/rbac.middleware");

// Pemilihan sumber data per modul. SUMBER_DATA=simrs mengalihkan Pasien,
// Operasi, Konsultasi, Kunjungan, Dashboard, JasaMedis, Lab, dan Radiologi ke replika
// MySQL SIMRS; modul lain tetap ke PostgreSQL lokal karena SIMRS memang tidak
// menyimpannya (Notifikasi, AuditLog, Pengguna, Kalender).
//
// Default sengaja `dummy`: menyalakan mode SIMRS berarti aplikasi ini mulai
// memproses data pasien asli, dan itu keputusan sadar — bukan sesuatu yang
// boleh terjadi karena env kebetulan kosong.
const SUMBER_SIMRS = process.env.SUMBER_DATA === "simrs";

const pasien = SUMBER_SIMRS ? require("./routes/simrs/pasien.routes") : pasienRoutes;
const operasi = SUMBER_SIMRS ? require("./routes/simrs/operasi.routes") : operasiRoutes;
const konsultasi = SUMBER_SIMRS ? require("./routes/simrs/konsultasi.routes") : konsultasiRoutes;
const kunjungan = SUMBER_SIMRS ? require("./routes/simrs/kunjungan.routes") : kunjunganRoutes;
const dashboard = SUMBER_SIMRS ? require("./routes/simrs/dashboard.routes") : dashboardRoutes;
const pendapatan = SUMBER_SIMRS ? require("./routes/simrs/pendapatan.routes") : pendapatanRoutes;
const lab = SUMBER_SIMRS ? require("./routes/simrs/lab.routes") : labRoutes;
const radiologi = SUMBER_SIMRS ? require("./routes/simrs/radiologi.routes") : radiologiRoutes;

if (SUMBER_SIMRS) {
  console.warn(
    "[SIDOKMAIS] SUMBER_DATA=simrs — Pasien/Kunjungan/Operasi/Konsultasi/Dashboard/JasaMedis/Lab/Radiologi membaca DATA PASIEN ASLI dari replika SIMRS (read-only)."
  );
}

const app = express();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/pasien", authenticate, authorize("DOKTER", "ADMIN"), pasien);
app.use("/api/operasi", authenticate, authorize("DOKTER", "ADMIN"), operasi);
app.use("/api/kunjungan", authenticate, authorize("DOKTER", "ADMIN"), kunjungan);
app.use("/api/konsultasi", authenticate, authorize("DOKTER", "ADMIN"), konsultasi);
app.use("/api/notifikasi", authenticate, authorize("DOKTER", "ADMIN"), notifikasiRoutes);
app.use("/api/lab", authenticate, authorize("DOKTER", "ADMIN"), lab);
app.use("/api/radiologi", authenticate, authorize("DOKTER", "ADMIN"), radiologi);
app.use("/api/dashboard", authenticate, authorize("DOKTER", "ADMIN"), dashboard);
app.use("/api/kalender", authenticate, authorize("DOKTER", "ADMIN"), kalenderRoutes);
app.use("/api/pendapatan", authenticate, authorize("DOKTER", "ADMIN"), pendapatan);

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
