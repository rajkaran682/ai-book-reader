const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 10000;

// ===============================
// Upload setup
// ===============================

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

    const name =
      Date.now() +
      "-" +
      Math.random().toString(36).substring(2, 8) +
      ext;

    cb(null, name);
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
          "केवल PDF, JPG, PNG और WEBP फाइल स्वीकार की जाती है।"
        )
      );
    }
  }
});

// ===============================
// OCR
// ===============================

const Tesseract = require("tesseract.js");

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

// ===============================
// Translation languages
// ===============================

const TRANSLATION_LANGUAGES = {
  hi: "Hindi",
  en: "English",
  bn: "Bengali",
  ta: "Tamil",
  te: "Telugu",
  mr: "Marathi",
  gu: "Gujarati",
  pa: "Punjabi",
  ur: "Urdu",
  ar: "Arabic",
  fr: "French",
  de: "German",
  es: "Spanish",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese"
};

// ===============================
// Health
// ===============================

app.get("/api/health", (req, res) => {

  res.json({
    ok: true,
    service: "AI Book Reader",
    time: new Date().toISOString()
  });

});

// ===============================
// OCR languages
// ===============================

app.get("/api/languages", (req, res) => {
  res.json(OCR_LANGUAGES);
});

// ===============================
// Translation languages
// ===============================

app.get("/api/translation-languages", (req, res) => {
  res.json(TRANSLATION_LANGUAGES);
});

// ===============================
// OCR image
// ===============================

app.post(
  "/api/ocr-image",
  upload.single("image"),
  async (req, res) => {

    if (!req.file) {

      return res.status(400).json({
        ok: false,
        message: "इमेज फाइल नहीं मिली।"
      });

    }

    try {

      let language = req.body.language || "eng";

      if (language === "auto") {
        language = "eng";
      }

      if (!OCR_LANGUAGES[language]) {
        language = "eng";
      }

      const result = await Tesseract.recognize(
        req.file.path,
        language,
        {
          logger: info => {

            if (info.status === "recognizing text") {

              console.log(
                `OCR progress: ${Math.round(
                  (info.progress || 0) * 100
                )}%`
              );

            }

          }
        }
      );

      const text = result?.data?.text || "";

      const confidence =
        typeof result?.data?.confidence === "number"
          ? Math.round(result.data.confidence)
          : 0;

      res.json({

        ok: true,

        text,

        confidence,

        language,

        detectedLanguage:
          OCR_LANGUAGES[language] || language

      });

    } catch (error) {

      console.error("OCR error:", error);

      res.status(500).json({

        ok: false,

        message: "OCR प्रक्रिया में समस्या हुई।",

        error: error.message

      });

    } finally {

      try {

        if (
          req.file?.path &&
          fs.existsSync(req.file.path)
        ) {
          fs.unlinkSync(req.file.path);
        }

      } catch (e) {

        console.log(
          "Temporary file cleanup failed:",
          e.message
        );

      }

    }

  }
);

// ===============================
// File upload
// ===============================

app.post(
  "/api/upload",
  upload.single("file"),
  (req, res) => {

    if (!req.file) {

      return res.status(400).json({
        ok: false,
        message: "फाइल नहीं मिली।"
      });

    }

    res.json({

      ok: true,

      filename: req.file.filename,

      originalName: req.file.originalname,

      size: req.file.size,

      type: req.file.mimetype

    });

  }
);

// ===============================
// Lingva Translation
// ===============================

const LINGVA_HOST =
  "https://lingva.ml";

// Language mapping

const TRANSLATION_CODES = {

  hi: "hi",
  en: "en",
  bn: "bn",
  ta: "ta",
  te: "te",
  mr: "mr",
  gu: "gu",
  pa: "pa",
  ur: "ur",
  ar: "ar",
  fr: "fr",
  de: "de",
  es: "es",
  ja: "ja",
  ko: "ko",
  zh: "zh"

};

// ===============================
// Translate function
// ===============================

async function translateWithLingva(
  text,
  source,
  target
) {

  const targetCode =
    TRANSLATION_CODES[target];

  if (!targetCode) {

    throw new Error(
      "Target language supported नहीं है।"
    );

  }

  let sourceCode = "auto";

  if (
    source &&
    source !== "auto" &&
    TRANSLATION_CODES[source]
  ) {

    sourceCode =
      TRANSLATION_CODES[source];

  }

  const encodedText =
    encodeURIComponent(text);

  const url =
    `${LINGVA_HOST}/api/v1/` +
    `${sourceCode}/` +
    `${targetCode}/` +
    `${encodedText}`;

  console.log(
    "Translation request:",
    sourceCode,
    "→",
    targetCode
  );

  const response =
    await fetch(url, {

      method: "GET",

      headers: {
        "Accept": "application/json"
      }

    });

  const data =
    await response.json().catch(
      () => ({})
    );

  if (!response.ok) {

    throw new Error(
      data?.error ||
      `Translation server error: ${response.status}`
    );

  }

  if (data?.error) {

    throw new Error(
      data.error
    );

  }

  if (!data?.translation) {

    throw new Error(
      "Translation server ने translated text नहीं भेजा।"
    );

  }

  return data.translation;

}

// ===============================
// Translation endpoint
// ===============================

app.post(
  "/api/translate",
  async (req, res) => {

    try {

      const text =
        String(
          req.body.text || ""
        ).trim();

      const source =
        String(
          req.body.source || "auto"
        );

      const target =
        String(
          req.body.target || "hi"
        );

      if (!text) {

        return res.status(400).json({

          ok: false,

          message:
            "Translate करने के लिए text जरूरी है।"

        });

      }

      if (!TRANSLATION_LANGUAGES[target]) {

        return res.status(400).json({

          ok: false,

          message:
            "Target language supported नहीं है।"

        });

      }

      // Same language

      if (
        source !== "auto" &&
        TRANSLATION_CODES[source] &&
        TRANSLATION_CODES[source] ===
          TRANSLATION_CODES[target]
      ) {

        return res.json({

          ok: true,

          translatedText: text,

          source,

          target,

          provider: "local"

        });

      }

      const translatedText =
        await translateWithLingva(
          text,
          source,
          target
        );

      res.json({

        ok: true,

        translatedText,

        source,

        target,

        provider: "Lingva Translate"

      });

    } catch (error) {

      console.error(
        "Translation error:",
        error
      );

      res.status(503).json({

        ok: false,

        message:
          "Translation service अभी उपलब्ध नहीं है।",

        error:
          error.message

      });

    }

  }
);

// ===============================
// Static files
// ===============================

app.use(
  express.static(__dirname)
);

// ===============================
// Error handler
// ===============================

app.use(
  (error, req, res, next) => {

    console.error(
      "Server error:",
      error
    );

    res.status(500).json({

      ok: false,

      message:
        error.message ||
        "Server में एक error हुआ।"

    });

  }
);

// ===============================
// Start server
// ===============================

app.listen(
  PORT,
  () => {

    console.log(
      `AI Book Reader running on port ${PORT}`
    );

  }
);
