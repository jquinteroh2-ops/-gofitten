const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const DIRS = ["images/productos", "images/ofertas"];
const MAX_WIDTH = 900;
const JPEG_QUALITY = 78;
const WEBP_QUALITY = 78;
const PNG_QUALITY = 78;

async function compressFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const before = fs.statSync(filePath).size;

  const buffer = fs.readFileSync(filePath);
  let pipeline = sharp(buffer).resize({ width: MAX_WIDTH, withoutEnlargement: true });

  if (ext === ".png") {
    pipeline = pipeline.png({ quality: PNG_QUALITY, compressionLevel: 9 });
  } else if (ext === ".webp") {
    pipeline = pipeline.webp({ quality: WEBP_QUALITY });
  } else if (ext === ".jpg" || ext === ".jpeg") {
    pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
  } else {
    return { before, after: before, skipped: true };
  }

  const outBuffer = await pipeline.toBuffer();
  if (outBuffer.length < before) {
    fs.writeFileSync(filePath, outBuffer);
    return { before, after: outBuffer.length, skipped: false };
  }
  return { before, after: before, skipped: true };
}

async function main() {
  let totalBefore = 0;
  let totalAfter = 0;
  let count = 0;
  let errors = 0;

  for (const dir of DIRS) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f));
    for (const f of files) {
      const fp = path.join(dir, f);
      try {
        const { before, after } = await compressFile(fp);
        totalBefore += before;
        totalAfter += after;
        count++;
        if (count % 500 === 0) {
          console.log(`Progreso: ${count} imágenes procesadas...`);
        }
      } catch (e) {
        errors++;
        console.error(`Error en ${fp}: ${e.message}`);
      }
    }
  }

  console.log("=== RESUMEN ===");
  console.log(`Imágenes procesadas: ${count} (errores: ${errors})`);
  console.log(`Antes: ${(totalBefore / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Después: ${(totalAfter / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Ahorro: ${(((totalBefore - totalAfter) / totalBefore) * 100).toFixed(1)}%`);
}

main();
