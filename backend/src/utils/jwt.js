const jwt = require("jsonwebtoken");

// Placeholder yang pernah beredar di .env.example / docker-compose. Ditolak
// eksplisit: nilainya ada di repo, jadi siapa pun yang bisa membaca repo ini
// bisa menandatangani token ADMIN sendiri.
const PLACEHOLDER = ["change-me-to-a-long-random-secret", "secret", "changeme"];
const PANJANG_MINIMAL = 32;

const SECRET = process.env.JWT_SECRET;

// Diperiksa sekali saat modul dimuat — artinya saat server boot, bukan saat
// login pertama. Kunci yang lemah harus membuat server GAGAL START, bukan
// diam-diam menerbitkan token yang bisa dipalsukan. Seluruh isolasi antar-dokter
// di aplikasi ini diturunkan dari klaim JWT, jadi kunci yang bisa ditebak
// meruntuhkan semua pengecekan akses sekaligus, bukan cuma satu endpoint.
if (!SECRET || SECRET.length < PANJANG_MINIMAL || PLACEHOLDER.includes(SECRET)) {
  throw new Error(
    `JWT_SECRET tidak valid: wajib diisi, minimal ${PANJANG_MINIMAL} karakter, ` +
      "dan bukan nilai placeholder. Generate dengan: openssl rand -base64 48"
  );
}

// dokterId boleh null (mis. akun ADMIN yang tidak terikat ke satu Dokter).
// Klaim ini adalah SATU-SATUNYA sumber dokterId yang boleh dipercaya oleh
// endpoint manapun ke depannya — jangan pernah terima dokterId dari
// body/query/param request.
function signToken({ id, dokterId, role }) {
  return jwt.sign({ sub: id, dokterId: dokterId ?? null, role }, SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
}

function verifyToken(token) {
  // Algoritma dipin ke HS256 — tanpa ini, penerima menuruti header `alg` milik
  // token, dan itu kelas kerentanan tersendiri kalau nanti kuncinya berubah
  // jadi pasangan asimetris.
  return jwt.verify(token, SECRET, { algorithms: ["HS256"] });
}

module.exports = { signToken, verifyToken };
