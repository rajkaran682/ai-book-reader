
const express = require("express");
const multer = require("multer");
const Tesseract = require("tesseract.js");
const fs = require("fs");
const os = require("os");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

app.disable("x-powered-by");

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// --------------------------------------------------
// LANGUAGE CONFIGURATION
// --------------------------------------------------

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
  fra: "French",
  deu: "German",
  spa: "Spanish",
  jpn: "Japanese",
  kor: "Korean",
  chi_sim: "Chinese"
};

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

// OCR language code -> translation language code
const OCR_TO_TRANSLATION = {
  eng: "en",
  hin: "hi",
  ben: "bn",
  tam: "ta",
  tel: "te",
  mar: "mr",
  guj: "gu",
  pan: "pa",
  urd: "ur",
  ara: "ar",
  fra: "fr",
  deu: "de",
  spa: "es",
  jpn: "ja",
  kor: "ko",
  chi_sim: "zh"
};

// --------------------------------------------------
// FILE UPLOAD CONFIGURATION
// --------------------------------------------------

const upload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 100 * 1024 * 1024
  },
  fileFilter: (req, file, callback) => {
    const ext = path.extname(file.originalname || "").toLowerCase();

    const allowedExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
      ".bmp",
      ".tif",
      ".tiff",
      ".pdf"
    ];

    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/bmp",
      "image/tiff",
      "application/pdf"
    ];

    if (
      allowedExtensions.includes(ext) ||
      allowedMimeTypes.includes(file.mimetype)
    ) {
      return callback(null, true);
    }

    callback(
      new Error("कृपया JPG, PNG, WEBP, TIFF या PDF फाइल चुनें।")
    );
  }
});

function deleteTemporaryFile(filePath) {
  if (!filePath) return;

  fs.unlink(filePath, (error) => {
    if (error && error.code !== "ENOENT") {
      console.error("Temporary file cleanup error:", error.message);
    }
  });
}

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "AI बुक रीडर",
    time: new Date().toISOString()
  });
});

// --------------------------------------------------
// LANGUAGE LIST APIs
// --------------------------------------------------

app.get("/api/languages", (req, res) => {
  res.json({
    ok: true,
    languages: OCR_LANGUAGES
  });
});

app.get("/api/translation-languages", (req, res) => {
  res.json({
    ok: true,
    languages: TRANSLATION_LANGUAGES
  });
});

// --------------------------------------------------
// OCR API
// --------------------------------------------------

app.post(
  "/api/ocr-image",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "image", maxCount: 1 },
    { name: "book", maxCount: 1 }
  ]),
  async (req, res) => {
    let file;

    try {
      file =
        req.files?.file?.[0] ||
        req.files?.image?.[0] ||
        req.files?.book?.[0];

      if (!file) {
        return res.status(400).json({
          ok: false,
          error: "फोटो नहीं मिली। पहले फोटो अपलोड करें।"
        });
      }

      const ext = path.extname(file.originalname || "").toLowerCase();

      if (
        file.mimetype === "application/pdf" ||
        ext === ".pdf"
      ) {
        return res.status(415).json({
          ok: false,
          error:
            "PDF का page-by-page OCR अभी उपलब्ध नहीं है। कृपया PDF के पेज की फोटो अपलोड करें।"
        });
      }

      let requestedLanguage = String(
        req.body?.language || "auto"
      ).toLowerCase();

      let ocrLanguage;

      if (requestedLanguage === "auto" || requestedLanguage === "") {
        // Tesseract does not automatically detect every language.
        // Hindi + English is the default for this reader.
        ocrLanguage = "hin+eng";
      } else if (requestedLanguage === "hin") {
        ocrLanguage = "hin+eng";
      } else if (OCR_LANGUAGES[requestedLanguage]) {
        ocrLanguage = requestedLanguage;
      } else {
        return res.status(400).json({
          ok: false,
          error: "चुनी गई OCR भाषा समर्थित नहीं है।"
        });
      }

      console.log("Starting OCR with:", ocrLanguage);

      const result = await Tesseract.recognize(
        file.path,
        ocrLanguage,
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

      const recognizedText = result?.data?.text || "";
      const confidence = Number(result?.data?.confidence || 0);

      console.log("OCR completed. Confidence:", confidence);

      const languageName =
        ocrLanguage === "hin+eng"
          ? "हिन्दी + English"
          : OCR_LANGUAGES[requestedLanguage] || "English";

      return res.json({
        ok: true,
        text: recognizedText,
        confidence,
        language: ocrLanguage,
        languageName,
        detectedLanguage: requestedLanguage === "auto"
          ? "auto"
          : requestedLanguage
      });
    } catch (error) {
      console.error("OCR error:", error.stack || error.message);

      return res.status(500).json({
        ok: false,
        error:
          "फोटो का टेक्स्ट पहचानने में समस्या आई। साफ फोटो लेकर दोबारा कोशिश करें।",
        details: error.message
      });
    } finally {
      if (file?.path) {
        deleteTemporaryFile(file.path);
      }
    }
  }
);

// Compatibility endpoint for clients that use /api/upload
app.post(
  "/api/upload",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "image", maxCount: 1 },
    { name: "book", maxCount: 1 }
  ]),
  (req, res) => {
    const file =
      req.files?.file?.[0] ||
      req.files?.image?.[0] ||
      req.files?.book?.[0];

    if (!file) {
      return res.status(400).json({
        ok: false,
        error: "अपलोड करने के लिए फाइल नहीं मिली।"
      });
    }

    const details = {
      ok: true,
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    };

    deleteTemporaryFile(file.path);

    return res.json(details);
  }
);

// --------------------------------------------------
// TRANSLATION HELPERS
// --------------------------------------------------

function detectSourceLanguage(text) {
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  if (/[\u0980-\u09FF]/.test(text)) return "bn";
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta";
  if (/[\u0C00-\u0C7F]/.test(text)) return "te";
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu";
  if (/[\u0A00-\u0A7F]/.test(text)) return "pa";
  if (/[\u0600-\u06FF]/.test(text)) return "ur";
  if (/[\u3040-\u30FF]/.test(text)) return "ja";
  if (/[\uAC00-\uD7AF]/.test(text)) return "ko";
  if (/[\u4E00-\u9FFF]/.test(text)) return "zh";

  return "en";
}

async function translateWithLingva(text, source, target) {
  const targetCode = TRANSLATION_LANGUAGES[target]
    ? target
    : null;

  if (!targetCode) {
    throw new Error("चुनी गई अनुवाद भाषा समर्थित नहीं है।");
  }

  const sourceCode =
    source !== "auto" && TRANSLATION_LANGUAGES[source]
      ? source
      : detectSourceLanguage(text);

  if (sourceCode === targetCode) {
    return text;
  }

  const errors = [];

  // Try Lingva instances first.
  const hosts = [
    "https://lingva.ml",
    "https://lingva.thedaviddelta.com"
  ];

  for (const host of hosts) {
    try {
      const url =
        host +
        "/api/v1/" +
        sourceCode +
        "/" +
        targetCode +
        "/" +
        encodeURIComponent(text);

      const response = await fetch(url, {
        headers: {
          Accept: "application/json"
        },
        signal: AbortSignal.timeout(12000)
      });

      const data = await response.json().catch(() => ({}));

      if (
        response.ok &&
        !data.error &&
        typeof data.translation === "string" &&
        data.translation.trim()
      ) {
        return data.translation;
      }

      errors.push(host + ": invalid response");
    } catch (error) {
      errors.push(host + ": " + error.message);
    }
  }

  // Public fallback: MyMemory.
  // This service can impose rate limits and usage restrictions.
  try {
    const chunks = [];
    let remaining = text.trim();

    while (remaining.length > 0) {
      if (remaining.length <= 450) {
        chunks.push(remaining);
        break;
      }

      let cut = remaining.lastIndexOf(" ", 450);

      if (cut < 200) {
        cut = 450;
      }

      chunks.push(remaining.slice(0, cut));
      remaining = remaining.slice(cut).trim();
    }

    const translatedChunks = [];

    for (const chunk of chunks) {
      const url = new URL(
        "https://api.mymemory.translated.net/get"
      );

      url.searchParams.set("q", chunk);
      url.searchParams.set(
        "langpair",
        sourceCode + "|" + targetCode
      );

      const response = await fetch(url, {
        headers: {
          Accept: "application/json"
        },
        signal: AbortSignal.timeout(15000)
      });

      const data = await response.json().catch(() => ({}));

      const translated = data?.responseData?.translatedText;

      if (
        !response.ok ||
        Number(data?.responseStatus) !== 200 ||
        typeof translated !== "string" ||
        !translated.trim()
      ) {
        throw new Error(
          data?.responseDetails ||
          "वैकल्पिक अनुवाद सेवा ने सही उत्तर नहीं दिया।"
        );
      }

      translatedChunks.push(translated);
    }

    return translatedChunks.join(" ");
  } catch (error) {
    errors.push("MyMemory: " + error.message);

    console.error(
      "All translation providers failed:",
      errors.join(" | ")
    );

    throw new Error(
      "अनुवाद सेवाएँ अभी उपलब्ध नहीं हैं। थोड़ी देर बाद फिर प्रयास करें।"
    );
  }
}

// --------------------------------------------------
// TRANSLATION API
// --------------------------------------------------

app.post("/api/translate", async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();

    const source = String(
      req.body?.source || "auto"
    ).toLowerCase();

    const target = String(
      req.body?.target ||
      req.body?.targetLanguage ||
      "hi"
    ).toLowerCase();

    if (!text) {
      return res.status(400).json({
        ok: false,
        error: "अनुवाद के लिए पहले टेक्स्ट दर्ज करें।"
      });
    }

    if (text.length > 10000) {
      return res.status(400).json({
        ok: false,
        error: "एक बार में अधिकतम 10,000 अक्षर अनुवाद करें।"
      });
    }

    if (!TRANSLATION_LANGUAGES[target]) {
      return res.status(400).json({
        ok: false,
        error: "चुनी गई अनुवाद भाषा समर्थित नहीं है।"
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
      provider: "Translation fallback"
    });
  } catch (error) {
    console.error("Translation error:", error.stack || error.message);

    return res.status(503).json({
      ok: false,
      error:
        error.message ||
        "अनुवाद सेवा अभी उपलब्ध नहीं है।"
    });
  }
});

// --------------------------------------------------
// STATIC WEBSITE
// --------------------------------------------------

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// --------------------------------------------------
// ERROR HANDLING
// --------------------------------------------------

app.use((error, req, res, next) => {
  console.error("Server request error:", error.stack || error.message);

  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "फाइल बहुत बड़ी है। अधिकतम सीमा 100 MB है।"
        : "फाइल अपलोड नहीं हो सकी। दोबारा कोशिश करें।";

    return res.status(400).json({
      ok: false,
      error: message
    });
  }

  return res.status(500).json({
    ok: false,
    error: error.message || "सर्वर में एक त्रुटि आई।"
  });
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(PORT, "0.0.0.0", () => {
  console.log("AI Book Reader running on port " + PORT);
});
