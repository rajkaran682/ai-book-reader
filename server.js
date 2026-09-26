const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const Tesseract = require("tesseract.js");

const app = express();

const PORT = process.env.PORT || 10000;

const uploadDir =
  path.join(__dirname, "uploads");


// ========================================
// CREATE UPLOAD DIRECTORY
// ========================================

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true
  });
}


// ========================================
// MULTER STORAGE
// ========================================

const storage =
  multer.diskStorage({

    destination: (req, file, cb) => {

      cb(null, uploadDir);

    },

    filename: (req, file, cb) => {

      const ext =
        path.extname(file.originalname);

      const filename =
        Date.now() +
        "-" +
        Math.random()
          .toString(36)
          .substring(2, 9) +
        ext;

      cb(null, filename);

    }

  });


const upload =
  multer({

    storage,

    limits: {

      fileSize:
        100 * 1024 * 1024

    },

    fileFilter:
      (req, file, cb) => {

        const allowed = [

          "application/pdf",

          "image/jpeg",

          "image/png",

          "image/webp"

        ];


        if (
          allowed.includes(
            file.mimetype
          )
        ) {

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


// ========================================
// MIDDLEWARE
// ========================================

app.use(
  express.json({
    limit: "10mb"
  })
);

app.use(
  express.urlencoded({
    extended: true
  })
);

app.use(
  express.static(__dirname)
);


// ========================================
// OCR LANGUAGES
// ========================================

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


// ========================================
// TRANSLATION LANGUAGES
// ========================================

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


// ========================================
// HEALTH
// ========================================

app.get(
  "/api/health",
  (req, res) => {

    res.json({

      ok: true,

      app:
        "AI Book Reader",

      version:
        "1.3.0",

      features: [

        "upload",

        "multilingual-ocr",

        "translation-ready"

      ]

    });

  }
);


// ========================================
// OCR LANGUAGES API
// ========================================

app.get(
  "/api/languages",
  (req, res) => {

    res.json({

      ok: true,

      languages:
        OCR_LANGUAGES

    });

  }
);


// ========================================
// TRANSLATION LANGUAGES API
// ========================================

app.get(
  "/api/translation-languages",
  (req, res) => {

    res.json({

      ok: true,

      languages:
        TRANSLATION_LANGUAGES

    });

  }
);


// ========================================
// IMAGE OCR
// ========================================

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
        req.body.language ||
        "eng";


      const language =
        OCR_LANGUAGES[
          requestedLanguage
        ]

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

            logger:
              info => {

                if (
                  info.status
                ) {

                  const progress =
                    info.progress !==
                    undefined

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

        type:
          "image",

        language,

        languageName:
          OCR_LANGUAGES[
            language
          ],

        originalName:
          req.file.originalname,

        text,

        confidence:
          result.data.confidence ||
          null

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


// ========================================
// TRANSLATION API
// ========================================
//
// अभी यह endpoint translation-ready है।
// वास्तविक translation provider अगले चरण में जोड़ा जाएगा.
//

app.post(
  "/api/translate",

  async (req, res) => {

    try {

      const text =
        typeof req.body.text ===
        "string"

          ? req.body.text.trim()

          : "";


      const source =
        req.body.source ||
        "auto";


      const target =
        req.body.target ||
        "hi";


      if (!text) {

        return res.status(400).json({

          ok: false,

          message:
            "Translation के लिए text जरूरी है।"

        });

      }


      if (
        !TRANSLATION_LANGUAGES[
          target
        ]
      ) {

        return res.status(400).json({

          ok: false,

          message:
            "यह target language अभी उपलब्ध नहीं है।"

        });

      }


      console.log(
        "Translation request:",
        {
          source,
          target,
          characters:
            text.length
        }
      );


      // --------------------------------
      // SAME LANGUAGE
      // --------------------------------

      if (
        source !== "auto" &&
        source === target
      ) {

        return res.json({

          ok: true,

          translatedText:
            text,

          source,

          target,

          provider:
            "local"

        });

      }


      // --------------------------------
      // TRANSLATION PROVIDER PLACEHOLDER
      // --------------------------------

      return res.status(503).json({

        ok: false,

        ready: true,

        message:
          "Translation engine अभी connect नहीं किया गया है।",

        source,

        target,

        supportedLanguages:
          TRANSLATION_LANGUAGES

      });


    } catch (error) {

      console.error(
        "TRANSLATION ERROR:",
        error
      );


      res.status(500).json({

        ok: false,

        message:
          "Translation करते समय समस्या हुई।",

        error:
          error.message

      });

    }

  }

);


// ========================================
// NORMAL FILE UPLOAD
// ========================================

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


// ========================================
// ERROR HANDLER
// ========================================

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


// ========================================
// START SERVER
// ========================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `AI Book Reader running on port ${PORT}`
    );

  }
);
