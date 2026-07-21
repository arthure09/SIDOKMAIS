// Factory: authorize('DOKTER', 'ADMIN') -> middleware.
// HARUS dipasang setelah authenticate di chain route. Kalau req.user belum
// ada, itu bug pemasangan middleware (bukan masalah auth user), jadi
// dibalikin 500 dengan pesan developer-facing, bukan 403.
function authorize(...allowedRoles) {
  return function (req, res, next) {
    if (!req.user) {
      return res.status(500).json({
        message:
          "authorize() dipanggil tanpa req.user — pastikan middleware authenticate dipasang sebelum authorize pada route ini",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Akses ditolak untuk role ini" });
    }

    next();
  };
}

module.exports = authorize;
