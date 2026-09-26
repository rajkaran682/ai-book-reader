const express = require("express");
const multer = require("multer");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    message: "AI Book Reader server is running"
  });
});

app.post("/api/upload", upload.single("book"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      ok: false,
      message: "कृपया PDF या image file upload करें।"
    });
  }

  res.json({
    ok: true,
    message: "File successfully received.",
    file: {
      originalName: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype
    }
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`AI Book Reader running on port ${PORT}`);
});
