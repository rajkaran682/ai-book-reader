
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Tesseract = require("tesseract.js");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Temporary upload folder
const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name =
      Date.now() + "-" +
      Math.random().toString(36).slice(2, 9) + ext;
    cb(null, name);
  }
});

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
];

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      return cb(null, true);
    }

    cb(new Error(
      "केवल JPG, PNG, WEBP या PDF फाइल अपलोड करें।"
    ));
  }
});

// OCR language names
const OCR_LANGUAGES = {
  eng: "English",
  hin: "हिन्दी",
  ben: "বাংলা",
  tam: "தமிழ்",
  tel: "తెలుగు",
  mar: "मराठी",
  guj: "ગુજરાતી",
  pan: "ਪੰਜਾਬੀ",
  urd: "اردو",
  ara: "العربية",
  fra: "Français",
  deu: "Deutsch",
  spa: "Español",
  jpn: "日本語",
  kor: "한국어",
  chi_sim: "中文"
};

// Translation languages
const TRANSLATION_LANGUAGES = {
  hi: "हिन्दी",
  en: "English",
  bn: "বাংলা",
  ta: "தமிழ்",
  te: "తెలుగు",
  mr: "मराठी",
  gu: "ગુજરાતી",
  pa: "ਪੰਜਾਬੀ",
  ur: "اردو",
  ar: "العربية",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
  ja: "日本語",
  ko: "한국어",
  zh: "中文"
};

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "AI Book Reader",
    time: new Date().toISOString()
  });
});

// Available OCR languages
app.get("/api/languages", (req, res) => {
  res.json(OCR_LANGUAGES);
});

// Available translation languages
app.get("/api/translation-languages", (req, res) => {
  res.json(TRANSLATION_LANGUAGES);
});

// OCR endpoint
// Accepts all three field names: file, image, book
app.post(
  "/api/ocr-image",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "image", maxCount: 1 },
    { name: "book", maxCount: 1 }
  ]),
  async (req, res) => {
    const ocrFile =
      req.files?.file?.[0] ||
      req.files?.image?.[0] ||
      req.files?.book?.[0];

    if (!ocrFile) {
      return res.status(400).json({
        ok: false,
        message: "फाइल नहीं मिली। कृपया फोटो चुनकर फिर प्रयास करें।"
      });
    }

    try {
      // Full PDF page-by-page OCR is not implemented yet.
      if (
        ocrFile.mimetype === "application/pdf" ||
        path.extname(ocrFile.originalname).toLowerCase() === ".pdf"
      ) {
        return res.status(400).json({
          ok: false,
          pdf: true,
          message:
            "PDF का page-by-page OCR अभी लागू नहीं है। कृपया JPG, PNG या WEBP फोटो से परीक्षण करें।"
        });
      }

      let language = String(
        req.body?.language || "auto"
      ).trim();

      // Auto-detection is not implemented yet.
      // For Hindi, combine Hindi and English recognition.
      if (language === "auto") {
        language = "hin+eng";
      } else if (language === "hin") {
        language = "hin+eng";
      } else if (language === "eng") {
        language = "eng";
      } else if (OCR_LANGUAGES[language]) {
        // Include English for labels and mixed-language text.
        language = language + "+eng";
      } else {
        language = "hin+eng";
      }

      console.log("Starting OCR with:", language);

      const result = await Tesseract.recognize(
        ocrFile.path,
        language,
        {
          logger: (info) => {
            if (info.status === "recognizing text") {
              console.log(
                "OCR progress:",
                Math.round((info.progress || 0) * 100) + "%"
              );
            }
          }
        }
      );

      const text = result?.data?.text || "";
      const confidence =
        typeof result?.data?.confidence === "number"
          ? Math.round(result.data.confidence)
          : null;

      console.log("OCR completed. Confidence:", confidence);

      return res.json({
        ok: true,
        text,
        confidence,
        language,
        languageName:
          language === "hin+eng"
            ? "हिन्दी + English"
            : (OCR_LANGUAGES[language] || language),
        detectedLanguage:
          language === "hin+eng"
            ? "हिन्दी + English (चुनी गई OCR भाषा)"
            : (OCR_LANGUAGES[language] || language)
      });
    } catch (error) {
      console.error("OCR error:", error);

      return res.status(500).json({
        ok: false,
        message: "OCR में समस्या हुई।",
        error: error.message
      });
    } finally {
      try {
        if (ocrFile.path && fs.existsSync(ocrFile.path)) {
          fs.unlinkSync(ocrFile.path);
        }
      } catch (cleanupError) {
        console.error(
          "Temporary file cleanup failed:",
          cleanupError.message
        );
      }
    }
  }
);

// Lingva translation service.
// This is a public service; availability is not guaranteed.
const LINGVA_HOST = "https://lingva.ml";

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

async function translateWithLingva(text, source, target) {
  const targetCode = TRANSLATION_CODES[target];

  if (!targetCode) {
    throw new Error("चुनी गई अनुवाद भाषा उपलब्ध नहीं है।");
  }

  const sourceCode =
    source !== "auto" && TRANSLATION_CODES[source]
      ? TRANSLATION_CODES[source]
      : "auto";

  const url =
    LINGVA_HOST +
    "/api/v1/" +
    sourceCode +
    "/" +
    targetCode +
    "/" +
    encodeURIComponent(text);

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20000)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.error || !data.translation) {
    throw new Error(
      data.error || "अनुवाद सेवा ने सही उत्तर नहीं दिया।"
    );
  }

  return data.translation;
}

// Translation API
app.post("/api/translate", async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    const source = String(req.body?.source || "auto");
    const target = String(req.body?.target || "hi");

    if (!text) {
      return res.status(400).json({
        ok: false,
        message: "अनुवाद के लिए पहले टेक्स्ट दर्ज करें।"
      });
    }

    if (text.length > 10000) {
      return res.status(400).json({
        ok: false,
        message: "एक बार में अधिकतम 10,000 अक्षर अनुवाद करें।"
      });
    }

    if (!TRANSLATION_LANGUAGES[target]) {
      return res.status(400).json({
        ok: false,
        message: "चुनी गई भाषा उपलब्ध नहीं है।"
      });
    }

    if (
      source !== "auto" &&
      TRANSLATION_CODES[source] &&
      TRANSLATION_CODES[source] === TRANSLATION_CODES[target]
    ) {
      return res.json({
        ok: true,
        translatedText: text,
        source,
        target,
        provider: "local"
      });
    }

    const translatedText = await translateWithLingva(
      text,
      source,
      target
    );

    return res.json({
      ok: true,
      translatedText,
      source,
      target,
      provider: "Lingva Translate"
    });
  } catch (error) {
    console.error("Translation error:", error);

    return res.status(503).json({
      ok: false,
      message: "अनुवाद सेवा अभी उपलब्ध नहीं है।",
      error: error.message
    });
  }
});

// Static website files
app.use(express.static(__dirname));

// Upload and server error handler
app.use((error, req, res, next) => {
  console.error("Request error:", error);

  const status =
    error instanceof multer.MulterError ? 400 : 400;

  res.status(status).json({
    ok: false,
    message: error.message || "फाइल प्रोसेस नहीं हो सकी।"
  });
});

// Start server
app.listen(PORT, () => {
  console.log("AI Book Reader running on port " + PORT);
});
