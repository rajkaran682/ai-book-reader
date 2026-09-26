const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

// Upload folder अपने-आप बनाएं
const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },

  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const name =
      Date.now() +
      "-" +
      Math.random().toString(36).substring(2, 9) +
      ext;

    cb(null, name);
  }
});

const upload = multer({
  storage: storage,

  limits: {
    fileSize: 100 * 1024 * 1024
  },

  fileFilter: function (req, file, cb) {
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("केवल PDF, JPG, PNG और WEBP फाइल स्वीकार हैं।"));
    }
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(__dirname));


// -----------------------------
// Health Check
// -----------------------------

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    app: "AI Book Reader",
    version: "1.0.0"
  });
});


// -----------------------------
// File Upload
// -----------------------------

app.post("/api/upload", upload.single("book"), (req, res) => {

  if (!req.file) {
    return res.status(400).json({
      ok: false,
      message: "कृपया PDF या image upload करें।"
    });
  }

  res.json({
    ok: true,
    message: "फाइल सफलतापूर्वक प्राप्त हो गई।",

    file: {
      originalName: req.file.originalname,
      savedName: req.file.filename,
      size: req.file.size,
      type: req.file.mimetype
    }
  });
});


// -----------------------------
// Error Handler
// -----------------------------

app.use((err, req, res, next) => {

  console.error(err);

  res.status(400).json({
    ok: false,
    message: err.message || "फाइल प्रोसेस नहीं हो सकी।"
  });

});


// -----------------------------
// Start Server
// -----------------------------

app.listen(PORT, "0.0.0.0", () => {
  console.log(`AI Book Reader running on port ${PORT}`);
});
