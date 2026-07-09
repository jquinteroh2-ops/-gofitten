const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname, {
  extensions: ["html"],
  setHeaders: (res, filePath) => {
    if (/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(filePath)) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
  },
}));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`FitStyle corriendo en el puerto ${PORT}`);
});
