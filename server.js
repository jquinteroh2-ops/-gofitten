const express = require("express");
const path = require("path");
const { buildRouter } = require("./server/api");
const { DATA_DIR, ensureDir } = require("./server/store");
const { currentUser, loadAdmins } = require("./server/auth");

const app = express();
const PORT = process.env.PORT || 3000;

// Railway va detrás de un proxy: necesario para detectar https y la IP real
app.set("trust proxy", 1);
ensureDir();

// API (login, productos, pedidos) — siempre antes de los archivos estáticos
app.use("/api", buildRouter());

// Panel de administración: solo se entrega si hay sesión iniciada.
// Sin sesión se muestra la pantalla de login.
app.get("/admin", (req, res) => {
  const file = currentUser(req) ? "admin.html" : "login.html";
  res.sendFile(path.join(__dirname, file));
});
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});
// El panel siempre se abre por /admin, para que pase por el control de sesión
app.get("/admin.html", (req, res) => res.redirect("/admin"));

// Solo se publican estas rutas. Todo lo demás (server/, data-store/ con los
// pedidos y las contraseñas, package.json, scripts/...) queda fuera de la web.
const RUTAS_PUBLICAS = /^\/(?:css|js|images)\/.+$|^\/(?:index|login)\.html$|^\/favicon\.ico$|^\/robots\.txt$/i;

const archivos = express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(filePath)) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
  },
});

// Normaliza la ruta antes de compararla, para que trucos como
// "/js/../data-store/admins.json" o "/js/%2e%2e/..." no burlen la lista.
function rutaNormalizada(ruta) {
  let r = ruta;
  for (let i = 0; i < 3; i++) {
    let previa = r;
    try { r = decodeURIComponent(r); } catch (e) { return null; }
    if (r === previa) break;
  }
  if (r.includes("\0")) return null;
  r = path.posix.normalize(r.replace(/\\/g, "/"));
  if (r.includes("..")) return null;
  return r;
}

app.use((req, res, next) => {
  const ruta = rutaNormalizada(req.path);
  if (ruta && RUTAS_PUBLICAS.test(ruta)) return archivos(req, res, next);
  next();
});

// Una ruta /api desconocida debe responder JSON, no el index
app.use("/api", (req, res) => res.status(404).json({ error: "Ruta no encontrada." }));

// Un archivo que no existe debe dar 404 y no la página de inicio
// (si no, el navegador recibiría HTML donde espera una imagen o un .js)
app.use((req, res, next) => {
  if (/^\/(?:css|js|images)\//.test(req.path)) return res.status(404).send("No encontrado");
  next();
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  loadAdmins(); // crea la cuenta del dueño la primera vez y avisa en el log
  console.log(`GoFitten corriendo en el puerto ${PORT}`);
  console.log(`Datos guardados en: ${DATA_DIR}`);
  console.log(`Panel de dueños: /admin`);
});
