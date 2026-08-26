/* ============================================================
   GoFitten - Almacenamiento en disco (JSON)
   ------------------------------------------------------------
   Todo se guarda en la carpeta DATA_DIR. En local es ./data-store
   En Railway conviene montar un Volume y poner DATA_DIR=/data
   para que los pedidos y los cambios NO se borren al desplegar.
   ============================================================ */
const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data-store");

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function filePath(name) {
  return path.join(DATA_DIR, name);
}

function readJson(name, fallback) {
  try {
    const raw = fs.readFileSync(filePath(name), "utf8");
    return JSON.parse(raw);
  } catch (e) {
    return typeof fallback === "function" ? fallback() : fallback;
  }
}

// Escritura atómica: primero a un temporal y luego rename, para que un corte
// de luz / reinicio no deje el archivo a medias.
function writeJson(name, value) {
  ensureDir();
  const dest = filePath(name);
  const tmp = dest + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tmp, dest);
  return value;
}

module.exports = { DATA_DIR, ensureDir, readJson, writeJson };
