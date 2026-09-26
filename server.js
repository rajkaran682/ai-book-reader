const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const Tesseract = require("tesseract.js");

const app = express();
const PORT = process.env.PORT || 10000;

const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);

    const filename =
      Date.now() +
      "-" +
      Math.random().toString(36).substring(2, 9) +
      ext;

    cb(null, filename);
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize: 100 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {

    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "केवल PDF, JPG, PNG और WEBP फाइल स्वीकार हैं।"
        )
      );
    }
  }
});


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));


// ================================
// LANGUAGE MAP
// ================================

const OCR_LANGUAGES = {

  eng: "English",

  hin: "Hindi",

  ben: "Bengali",

  tam: "Tamil",

  tel: "Telugu",

  mar: "Marathi",

  guj: "Gujarati",

  pan: "Punjabi",

  urd: "Urdu",

  ara: "Arabic",

  fra: "French",

  deu: "German",

  spa: "Spanish",

  jpn: "Japanese",

  kor: "Korean",

  chi_sim: "Chinese"

};


// ================================
// HEALTH
// ================================

app.get("/api/health", (req, res) => {

  res.json({
    ok: true,
    app: "AI Book Reader",
    version: "1.2.0"
  });

});


// ================================
// AVAILABLE OCR LANGUAGES
// ================================

app.get("/api/languages", (req, res) => {

  res.json({
    ok: true,
    languages: OCR_LANGUAGES
  });

});


// ================================
// IMAGE OCR
// ================================

app.post(
  "/api/ocr-image",
  upload.single("book"),
  async (req, res) => {

    try {

      if (!req.file) {

        return res.status(400).json({
          ok: false,
          message:
            "कृपया image upload करें।"
        });

      }

      const requestedLanguage =
        req.body.language || "eng";

      const language =
        OCR_LANGUAGES[requestedLanguage]
          ? requestedLanguage
          : "eng";

      console.log(
        "OCR language:",
        language
      );

      console.log(
        "OCR file:",
        req.file.originalname
      );


      const result =
        await Tesseract.recognize(
          req.file.path,
          language,
          {
            logger: info => {

              if (info.status) {

                const progress =
                  info.progress !== undefined
                    ? Math.round(
                        info.progress * 100
                      ) + "%"
                    : "";

                console.log(
                  `OCR ${info.status} ${progress}`
                );

              }

            }
          }
        );


      const text =
        result.data.text.trim();


      res.json({

        ok: true,

        type: "image",

        language,

        languageName:
          OCR_LANGUAGES[language],

        originalName:
          req.file.originalname,

        text,

        confidence:
          result.data.confidence || null

      });


    } catch (error) {

      console.error(
        "OCR ERROR:",
        error
      );

      res.status(500).json({

        ok: false,

        message:
          "OCR करते समय समस्या हुई।",

        error:
          error.message

      });

    }

  }
);


// ================================
// NORMAL UPLOAD
// ================================

app.post(
  "/api/upload",
  upload.single("book"),
  (req, res) => {

    try {

      if (!req.file) {

        return res.status(400).json({

          ok: false,

          message:
            "कृपया PDF या image upload करें।"

        });

      }


      res.json({

        ok: true,

        message:
          "फाइल सफलतापूर्वक प्राप्त हो गई।",

        file: {

          originalName:
            req.file.originalname,

          savedName:
            req.file.filename,

          size:
            req.file.size,

          type:
            req.file.mimetype

        }

      });

    } catch (error) {

      res.status(500).json({

        ok: false,

        message:
          error.message

      });

    }

  }
);


// ================================
// ERROR HANDLER
// ================================

app.use(
  (err, req, res, next) => {

    console.error(err);

    res.status(400).json({

      ok: false,

      message:
        err.message ||
        "फाइल प्रोसेस नहीं हो सकी।"

    });

  }
);


// ================================
// START
// ================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `AI Book Reader running on port ${PORT}`
    );

  }
);
