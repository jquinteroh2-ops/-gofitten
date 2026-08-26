/* ============================================================
   GoFitten - Autenticación de los dueños (login del panel)
   ------------------------------------------------------------
   - Contraseñas guardadas con scrypt + salt (nunca en texto plano).
   - Sesión en una cookie HttpOnly firmada con HMAC (sin dependencias).
   ============================================================ */
const crypto = require("crypto");
const { readJson, writeJson } = require("./store");

const ADMINS_FILE = "admins.json";
const CONFIG_FILE = "config.json";
const COOKIE_NAME = "gf_session";
const SESSION_DAYS = 7;

/* ---------- Contraseñas ---------- */
function hashPassword(password, salt) {
  const s = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), s, 64).toString("hex");
  return `${s}:${hash}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== "string" || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  try {
    const test = crypto.scryptSync(String(password), salt, 64).toString("hex");
    const a = Buffer.from(hash, "hex");
    const b = Buffer.from(test, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (e) {
    return false;
  }
}

/* ---------- Secreto de sesión (persistente entre reinicios) ---------- */
function getSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const cfg = readJson(CONFIG_FILE, {});
  if (cfg.sessionSecret) return cfg.sessionSecret;
  cfg.sessionSecret = crypto.randomBytes(32).toString("hex");
  writeJson(CONFIG_FILE, cfg);
  return cfg.sessionSecret;
}

/* ---------- Usuarios ---------- */
// La primera vez crea la cuenta inicial. Se puede fijar con las variables
// de entorno ADMIN_USER / ADMIN_PASSWORD; si no, usa la de por defecto.
function loadAdmins() {
  let db = readJson(ADMINS_FILE, null);
  if (!db || !Array.isArray(db.users) || db.users.length === 0) {
    const user = (process.env.ADMIN_USER || "admin").trim().toLowerCase();
    const pass = process.env.ADMIN_PASSWORD || "gofitten2026";
    db = {
      users: [{
        user,
        passwordHash: hashPassword(pass),
        createdAt: new Date().toISOString(),
        lastLogin: null,
        mustChangePassword: !process.env.ADMIN_PASSWORD,
      }],
    };
    writeJson(ADMINS_FILE, db);
    console.log(`[GoFitten] Cuenta de administrador creada: "${user}"`);
    if (!process.env.ADMIN_PASSWORD) {
      console.log('[GoFitten] Contraseña inicial: "gofitten2026" — cámbiala desde el panel.');
    }
  }
  return db;
}

function saveAdmins(db) {
  return writeJson(ADMINS_FILE, db);
}

function findUser(name) {
  const db = loadAdmins();
  const key = String(name || "").trim().toLowerCase();
  return db.users.find((u) => u.user === key) || null;
}

/* ---------- Tokens de sesión ---------- */
function sign(payloadB64) {
  return crypto.createHmac("sha256", getSecret()).update(payloadB64).digest("base64url");
}

function createToken(user) {
  const payload = { u: user, exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000 };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function readToken(token) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = sign(body);
  const a = Buffer.from(sig || "");
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

/* ---------- Cookies ---------- */
function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie;
  if (!raw) return out;
  raw.split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i < 0) return;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function setSessionCookie(req, res, token) {
  const secure = req.secure || req.headers["x-forwarded-proto"] === "https";
  const parts = [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_DAYS * 24 * 60 * 60}`,
  ];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

/* ---------- Middleware ---------- */
function currentUser(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  const payload = readToken(token);
  if (!payload) return null;
  return findUser(payload.u);
}

function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: "Debes iniciar sesión." });
  req.admin = user;
  next();
}

module.exports = {
  COOKIE_NAME,
  hashPassword,
  verifyPassword,
  loadAdmins,
  saveAdmins,
  findUser,
  createToken,
  setSessionCookie,
  clearSessionCookie,
  currentUser,
  requireAuth,
};
