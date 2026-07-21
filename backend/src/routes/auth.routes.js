const express = require("express");
const bcrypt = require("bcrypt");
const prisma = require("../lib/prisma");
const { signToken } = require("../utils/jwt");
const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username dan password wajib diisi" });
  }

  const pengguna = await prisma.pengguna.findUnique({
    where: { username },
    include: { dokter: true },
  });

  if (!pengguna) {
    return res.status(401).json({ message: "Username atau password salah" });
  }

  const isValid = await bcrypt.compare(password, pengguna.passwordHash);

  if (!isValid) {
    return res.status(401).json({ message: "Username atau password salah" });
  }

  const token = signToken({
    id: pengguna.id,
    dokterId: pengguna.dokterId,
    role: pengguna.role,
  });

  res.json({
    token,
    pengguna: {
      id: pengguna.id,
      username: pengguna.username,
      role: pengguna.role,
      dokter: pengguna.dokter
        ? {
            id: pengguna.dokter.id,
            nama: pengguna.dokter.nama,
            spesialisasi: pengguna.dokter.spesialisasi,
          }
        : null,
    },
  });
});

router.get("/me", authMiddleware, async (req, res) => {
  const pengguna = await prisma.pengguna.findUnique({
    where: { id: req.user.id },
    include: { dokter: true },
  });

  if (!pengguna) {
    return res.status(404).json({ message: "Pengguna tidak ditemukan" });
  }

  res.json({
    id: pengguna.id,
    username: pengguna.username,
    role: pengguna.role,
    dokter: pengguna.dokter
      ? {
          id: pengguna.dokter.id,
          nama: pengguna.dokter.nama,
          spesialisasi: pengguna.dokter.spesialisasi,
        }
      : null,
  });
});

module.exports = router;
