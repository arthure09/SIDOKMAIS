const { verifyToken } = require("../utils/jwt");

// Memverifikasi JWT dari header Authorization dan attach req.user.
// req.user.dokterId SELALU berasal dari klaim JWT yang sudah diverifikasi
// server-side di sini — tidak pernah dari body/query/param. Middleware
// berikutnya (route handler, chatbot, dst.) harus selalu pakai req.user,
// tidak boleh menerima dokterId dari input request.
function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token tidak ditemukan" });
  }

  const token = header.slice("Bearer ".length);

  if (!token) {
    return res.status(401).json({ message: "Token tidak ditemukan" });
  }

  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.sub,
      dokterId: payload.dokterId ?? null,
      role: payload.role,
    };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token tidak valid atau kedaluwarsa" });
  }
}

module.exports = authenticate;
