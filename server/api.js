/* ============================================================
   GoFitten - API del panel de administración
   ------------------------------------------------------------
   Público:  ajustes del catálogo + registro de pedidos.
   Privado:  login, edición de productos, historial de pedidos.
   ============================================================ */
const express = require("express");
const crypto = require("crypto");
const { readJson, writeJson } = require("./store");
const auth = require("./auth");

const OVERRIDES_FILE = "product-overrides.json";
const ORDERS_FILE = "orders.json";
const EXTRA_FILE = "products-extra.json";
const MAX_ORDERS = 3000;
const CATEGORIES = ["mujer", "hombre", "ninos", "accesorios", "deportes"];

/* ---------- Utilidades de saneamiento ---------- */
function str(v, max) {
  if (v === undefined || v === null) return "";
  return String(v).trim().slice(0, max || 200);
}
function intOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : null;
}
function money(n) {
  return Number(n || 0).toLocaleString("es-CO");
}

/* ---------- Límite de intentos (anti fuerza bruta / spam) ---------- */
function makeLimiter(maxHits, windowMs) {
  const hits = new Map();
  return function check(key) {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now > entry.reset) {
      if (hits.size > 5000) hits.clear();
      hits.set(key, { count: 1, reset: now + windowMs });
      return { ok: true };
    }
    entry.count++;
    if (entry.count > maxHits) {
      return { ok: false, waitMin: Math.ceil((entry.reset - now) / 60000) };
    }
    return { ok: true };
  };
}
const loginLimiter = makeLimiter(10, 10 * 60 * 1000);   // 10 intentos / 10 min
const orderLimiter = makeLimiter(30, 60 * 60 * 1000);   // 30 pedidos / hora por IP

function clientIp(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.ip || "local";
}

/* ---------- Ajustes de productos (overrides) ---------- */
function loadOverrides() {
  const db = readJson(OVERRIDES_FILE, { items: {}, updatedAt: null });
  if (!db.items || typeof db.items !== "object") db.items = {};
  return db;
}

function cleanOverride(body) {
  const out = {};
  if ("title" in body) out.title = str(body.title, 160);
  if ("description" in body) out.description = str(body.description, 4000);
  if ("priceNum" in body) {
    const n = intOrNull(body.priceNum);
    if (n !== null && n >= 0) { out.priceNum = n; out.price = money(n); }
  }
  if ("compareAtPrice" in body) {
    const n = intOrNull(body.compareAtPrice);
    out.compareAtPrice = n !== null && n > 0 ? n : null;
  }
  ["available", "onSale", "hidden"].forEach((k) => {
    if (k in body) out[k] = Boolean(body[k]);
  });
  // Un título vacío no debe borrar el original del catálogo
  if (out.title === "") delete out.title;
  return out;
}

/* ---------- Productos nuevos (creados desde el panel) ---------- */
function loadExtra() {
  const db = readJson(EXTRA_FILE, { items: [] });
  if (!Array.isArray(db.items)) db.items = [];
  return db;
}

function slugify(text) {
  return String(text || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "producto";
}

function strList(v, maxItems, maxLen) {
  const arr = Array.isArray(v) ? v : String(v || "").split("\n");
  return arr.map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems);
}

function cleanNewProduct(body) {
  const title = str(body.title, 160);
  const category = CATEGORIES.includes(body.category) ? body.category : "";
  const priceNum = intOrNull(body.priceNum);
  if (!title) return { error: "El nombre del producto es obligatorio." };
  if (!category) return { error: "Elige una categoría válida." };
  if (priceNum === null || priceNum < 0) return { error: "Escribe un precio válido." };

  const compareAtPrice = intOrNull(body.compareAtPrice);
  return {
    product: {
      title,
      price: money(priceNum),
      priceNum,
      compareAtPrice: compareAtPrice !== null && compareAtPrice > 0 ? compareAtPrice : null,
      category,
      subcategory: str(body.subcategory, 60),
      activity: str(body.activity, 60),
      onSale: Boolean(body.onSale),
      available: body.available === undefined ? true : Boolean(body.available),
      hidden: Boolean(body.hidden),
      sizes: strList(body.sizes, 20, 60),
      images: strList(body.images, 8, 500),
      description: str(body.description, 4000),
    },
  };
}

/* ---------- Pedidos ---------- */
function loadOrders() {
  const db = readJson(ORDERS_FILE, { nextNumero: 1, orders: [] });
  if (!Array.isArray(db.orders)) db.orders = [];
  if (!db.nextNumero) db.nextNumero = db.orders.length + 1;
  return db;
}

const STATUSES = ["nuevo", "confirmado", "entregado", "cancelado"];

function buildRouter() {
  const router = express.Router();
  router.use(express.json({ limit: "256kb" }));

  /* ================= PÚBLICO ================= */

  // El sitio pide estos ajustes al cargar para aplicar precios/estados editados.
  router.get("/catalogo/ajustes", (req, res) => {
    const db = loadOverrides();
    res.set("Cache-Control", "no-store");
    res.json({ items: db.items, updatedAt: db.updatedAt });
  });

  // Productos creados desde el panel (no vienen en el catálogo original).
  router.get("/catalogo/extra", (req, res) => {
    const db = loadExtra();
    res.set("Cache-Control", "no-store");
    res.json({ items: db.items.filter((p) => !p.hidden) });
  });

  // Registra el pedido justo antes de abrir WhatsApp.
  router.post("/pedidos", (req, res) => {
    const limit = orderLimiter(clientIp(req));
    if (!limit.ok) return res.status(429).json({ error: "Demasiados pedidos seguidos. Intenta más tarde." });

    const body = req.body || {};
    const rawItems = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
    if (rawItems.length === 0) return res.status(400).json({ error: "El pedido está vacío." });

    const items = rawItems.map((it) => {
      const cantidad = Math.max(1, Math.min(9999, parseInt(it.cantidad, 10) || 1));
      const priceNum = Math.max(0, intOrNull(it.priceNum) || 0);
      return {
        id: str(it.id, 120),
        title: str(it.title, 160),
        talla: str(it.talla, 60),
        category: str(it.category, 40),
        image: str(it.image, 300),
        cantidad,
        priceNum,
        subtotal: priceNum * cantidad,
      };
    });

    const subtotal = items.reduce((s, it) => s + it.subtotal, 0);
    const envio = Math.max(0, intOrNull(body.envio) || 0);
    const db = loadOrders();
    const order = {
      id: crypto.randomUUID(),
      numero: db.nextNumero,
      createdAt: new Date().toISOString(),
      status: "nuevo",
      cliente: {
        nombre: str(body.nombre, 100) || "Sin nombre",
        telefono: str(body.telefono, 40),
        ciudad: str(body.ciudad, 60),
        barrio: str(body.barrio, 80),
        direccion: str(body.direccion, 200),
        comentario: str(body.comentario, 500),
      },
      items,
      subtotal,
      envio,
      total: subtotal + envio,
      nota: "",
    };

    db.nextNumero++;
    db.orders.unshift(order);
    if (db.orders.length > MAX_ORDERS) db.orders.length = MAX_ORDERS;
    writeJson(ORDERS_FILE, db);
    res.json({ ok: true, id: order.id, numero: order.numero });
  });

  /* ================= SESIÓN ================= */

  router.post("/admin/login", (req, res) => {
    const limit = loginLimiter(clientIp(req));
    if (!limit.ok) {
      return res.status(429).json({ error: `Demasiados intentos. Espera ${limit.waitMin} minuto(s).` });
    }
    const usuario = str((req.body || {}).usuario, 60).toLowerCase();
    const password = String((req.body || {}).password || "");
    const user = auth.findUser(usuario);
    if (!user || !auth.verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "Usuario o contraseña incorrectos." });
    }
    const db = auth.loadAdmins();
    const stored = db.users.find((u) => u.user === user.user);
    if (stored) { stored.lastLogin = new Date().toISOString(); auth.saveAdmins(db); }

    auth.setSessionCookie(req, res, auth.createToken(user.user));
    res.json({ ok: true, usuario: user.user, mustChangePassword: !!user.mustChangePassword });
  });

  router.post("/admin/logout", (req, res) => {
    auth.clearSessionCookie(res);
    res.json({ ok: true });
  });

  router.get("/admin/sesion", (req, res) => {
    const user = auth.currentUser(req);
    if (!user) return res.status(401).json({ error: "Sin sesión." });
    res.json({ usuario: user.user, mustChangePassword: !!user.mustChangePassword });
  });

  /* ================= PRIVADO ================= */
  router.use("/admin", auth.requireAuth);

  // --- Productos ---
  router.get("/admin/ajustes", (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(loadOverrides());
  });

  router.put("/admin/producto/:id", (req, res) => {
    const id = str(req.params.id, 120);
    if (!id) return res.status(400).json({ error: "Producto no válido." });
    const cambios = cleanOverride(req.body || {});
    const db = loadOverrides();
    const actual = db.items[id] || {};
    db.items[id] = { ...actual, ...cambios, editadoPor: req.admin.user, editadoEn: new Date().toISOString() };
    db.updatedAt = new Date().toISOString();
    writeJson(OVERRIDES_FILE, db);
    res.json({ ok: true, item: db.items[id] });
  });

  // Devuelve el producto a sus valores originales del catálogo
  router.delete("/admin/producto/:id", (req, res) => {
    const id = str(req.params.id, 120);
    const db = loadOverrides();
    delete db.items[id];
    db.updatedAt = new Date().toISOString();
    writeJson(OVERRIDES_FILE, db);
    res.json({ ok: true });
  });

  // Cambio rápido de disponibilidad/visibilidad para varios productos a la vez
  router.post("/admin/productos/lote", (req, res) => {
    const ids = Array.isArray((req.body || {}).ids) ? req.body.ids.slice(0, 500) : [];
    const cambios = cleanOverride(req.body || {});
    if (!ids.length || !Object.keys(cambios).length) {
      return res.status(400).json({ error: "Nada que aplicar." });
    }
    const db = loadOverrides();
    const sello = { editadoPor: req.admin.user, editadoEn: new Date().toISOString() };
    ids.forEach((raw) => {
      const id = str(raw, 120);
      if (!id) return;
      db.items[id] = { ...(db.items[id] || {}), ...cambios, ...sello };
    });
    db.updatedAt = new Date().toISOString();
    writeJson(OVERRIDES_FILE, db);
    res.json({ ok: true, total: ids.length });
  });

  // --- Productos nuevos (creados desde el panel) ---
  router.get("/admin/productos-extra", (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(loadExtra());
  });

  router.post("/admin/productos-extra", (req, res) => {
    const result = cleanNewProduct(req.body || {});
    if (result.error) return res.status(400).json({ error: result.error });
    const db = loadExtra();
    const existingIds = new Set(db.items.map((p) => p.id));
    let id = slugify(result.product.title);
    if (existingIds.has(id)) id = `${id}-${crypto.randomBytes(3).toString("hex")}`;
    const item = {
      id,
      ...result.product,
      creadoPor: req.admin.user,
      creadoEn: new Date().toISOString(),
    };
    db.items.unshift(item);
    writeJson(EXTRA_FILE, db);
    res.json({ ok: true, item });
  });

  router.put("/admin/productos-extra/:id", (req, res) => {
    const id = str(req.params.id, 120);
    const db = loadExtra();
    const i = db.items.findIndex((p) => p.id === id);
    if (i < 0) return res.status(404).json({ error: "Producto no encontrado." });
    const result = cleanNewProduct({ ...db.items[i], ...req.body });
    if (result.error) return res.status(400).json({ error: result.error });
    db.items[i] = {
      ...db.items[i],
      ...result.product,
      editadoPor: req.admin.user,
      editadoEn: new Date().toISOString(),
    };
    writeJson(EXTRA_FILE, db);
    res.json({ ok: true, item: db.items[i] });
  });

  router.delete("/admin/productos-extra/:id", (req, res) => {
    const id = str(req.params.id, 120);
    const db = loadExtra();
    const i = db.items.findIndex((p) => p.id === id);
    if (i < 0) return res.status(404).json({ error: "Producto no encontrado." });
    db.items.splice(i, 1);
    writeJson(EXTRA_FILE, db);
    res.json({ ok: true });
  });

  // --- Pedidos ---
  router.get("/admin/pedidos", (req, res) => {
    const db = loadOrders();
    res.set("Cache-Control", "no-store");
    res.json({ orders: db.orders });
  });

  router.patch("/admin/pedidos/:id", (req, res) => {
    const db = loadOrders();
    const order = db.orders.find((o) => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: "Pedido no encontrado." });
    const body = req.body || {};
    if (body.status && STATUSES.includes(body.status)) order.status = body.status;
    if ("nota" in body) order.nota = str(body.nota, 500);
    writeJson(ORDERS_FILE, db);
    res.json({ ok: true, order });
  });

  router.delete("/admin/pedidos/:id", (req, res) => {
    const db = loadOrders();
    const i = db.orders.findIndex((o) => o.id === req.params.id);
    if (i < 0) return res.status(404).json({ error: "Pedido no encontrado." });
    db.orders.splice(i, 1);
    writeJson(ORDERS_FILE, db);
    res.json({ ok: true });
  });

  // --- Cuenta y usuarios ---
  router.post("/admin/password", (req, res) => {
    const actual = String((req.body || {}).actual || "");
    const nueva = String((req.body || {}).nueva || "");
    if (nueva.length < 6) return res.status(400).json({ error: "La nueva contraseña debe tener al menos 6 caracteres." });
    const db = auth.loadAdmins();
    const user = db.users.find((u) => u.user === req.admin.user);
    if (!user || !auth.verifyPassword(actual, user.passwordHash)) {
      return res.status(401).json({ error: "La contraseña actual no es correcta." });
    }
    user.passwordHash = auth.hashPassword(nueva);
    user.mustChangePassword = false;
    auth.saveAdmins(db);
    res.json({ ok: true });
  });

  router.get("/admin/usuarios", (req, res) => {
    const db = auth.loadAdmins();
    res.json({
      usuarios: db.users.map((u) => ({ user: u.user, createdAt: u.createdAt, lastLogin: u.lastLogin })),
      actual: req.admin.user,
    });
  });

  router.post("/admin/usuarios", (req, res) => {
    const nombre = str((req.body || {}).usuario, 60).toLowerCase().replace(/\s+/g, "");
    const password = String((req.body || {}).password || "");
    if (nombre.length < 3) return res.status(400).json({ error: "El usuario debe tener al menos 3 caracteres." });
    if (password.length < 6) return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres." });
    const db = auth.loadAdmins();
    if (db.users.some((u) => u.user === nombre)) return res.status(409).json({ error: "Ese usuario ya existe." });
    db.users.push({ user: nombre, passwordHash: auth.hashPassword(password), createdAt: new Date().toISOString(), lastLogin: null });
    auth.saveAdmins(db);
    res.json({ ok: true });
  });

  router.delete("/admin/usuarios/:user", (req, res) => {
    const nombre = str(req.params.user, 60).toLowerCase();
    if (nombre === req.admin.user) return res.status(400).json({ error: "No puedes eliminar tu propia cuenta." });
    const db = auth.loadAdmins();
    if (db.users.length <= 1) return res.status(400).json({ error: "Debe quedar al menos un administrador." });
    const i = db.users.findIndex((u) => u.user === nombre);
    if (i < 0) return res.status(404).json({ error: "Usuario no encontrado." });
    db.users.splice(i, 1);
    auth.saveAdmins(db);
    res.json({ ok: true });
  });

  return router;
}

module.exports = { buildRouter };
