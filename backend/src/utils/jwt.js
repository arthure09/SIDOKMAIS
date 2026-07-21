const jwt = require("jsonwebtoken");

// dokterId boleh null (mis. akun ADMIN yang tidak terikat ke satu Dokter).
// Klaim ini adalah SATU-SATUNYA sumber dokterId yang boleh dipercaya oleh
// endpoint manapun ke depannya — jangan pernah terima dokterId dari
// body/query/param request.
function signToken({ id, dokterId, role }) {
  return jwt.sign({ sub: id, dokterId: dokterId ?? null, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signToken, verifyToken };
