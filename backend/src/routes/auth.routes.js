const express = require("express");
const bcrypt = require("bcrypt");
const prisma = require("../lib/prisma");
const { signToken } = require("../utils/jwt");
const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();

// Satu bentuk untuk /login dan /me — dua literal terpisah sebelumnya, dan itu
// resep dua response yang diam-diam beda isinya.
// nip dipakai kartu identitas di ProfilDokterScreen. Aman: yang dikirim selalu
// identitas akun yang sedang login sendiri, bukan dokter lain. Nomor SIP tidak
// ikut dikirim — tidak ditampilkan di app (keputusan Arthuro, 2026-08-14), jadi
// tidak perlu keluar dari server sama sekali. Kolomnya tetap ada di DB.
function bentukPengguna(pengguna) {
  return {
    id: pengguna.id,
    username: pengguna.username,
    role: pengguna.role,
    dokter: pengguna.dokter
      ? {
          id: pengguna.dokter.id,
          nama: pengguna.dokter.nama,
          spesialisasi: pengguna.dokter.spesialisasi,
          nip: pengguna.dokter.nip,
        }
      : null,
  };
}

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

  res.json({ token, pengguna: bentukPengguna(pengguna) });
});

router.get("/me", authMiddleware, async (req, res) => {
  const pengguna = await prisma.pengguna.findUnique({
    where: { id: req.user.id },
    include: { dokter: true },
  });

  if (!pengguna) {
    return res.status(404).json({ message: "Pengguna tidak ditemukan" });
  }

  res.json(bentukPengguna(pengguna));
});

module.exports = router;
