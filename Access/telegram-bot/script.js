"use strict";

(() => {
  const INSTANCE = "__learningEmploymentFinal";
  if (window[INSTANCE]) return;
  window[INSTANCE] = true;

  function init() {
    /* =====================================================
       CONFIGURATION
       ===================================================== */

    const CONFIG = {
      apiBase:
        "https://learning-assistant-bot-production.up.railway.app",

      // Must match a real POST route on your server.
      answerPath: "/api/ask",

      telegram: "https://t.me/EbaMengistuBot",

      /*
       * Optional supported speech backend:
       * POST { text, language: "am-ET" | "en-US" }
       * Response: audio bytes with Content-Type: audio/*
       */
      speechPath: "",

      /*
       * Unofficial, best-effort fallback.
       * Answer text is sent to Google when used.
       */
      googleSpeechFallback: true
    };

    const $ = id => document.getElementById(id);
    const question = $("question");
    const answer = $("answer");

    if (!question || !answer) {
      console.error("Missing #question or #answer.");
      return;
    }

    const ETHIOPIC =
      /[\u1200-\u137f\u1380-\u139f\u2d80-\u2ddf]/;

    const STORAGE_KEY = "learning_employment_final";

    function loadSettings() {
      try {
        const data = JSON.parse(
          localStorage.getItem(STORAGE_KEY) || "{}"
        );
        return data && typeof data === "object" ? data : {};
      } catch {
        return {};
      }
    }

    const settings = loadSettings();

    let language = settings.language === "en" ? "en" : "am";
    let fontSize = Math.max(
      0.9,
      Math.min(1.8, Number(settings.fontSize) || 1.05)
    );

    const chatId = settings.chatId ||
      `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    let currentAnswer = null;
    let copiedQuestion = "";
    let requestVersion = 0;
    let answerController = null;

    let readingLanguage = null;
    let speechVersion = 0;
    let speechCancel = null;
    let speechController = null;
    let activeUtterance = null;
    let activeAudio = null;

    let microphone = null;
    let audioContext = null;

    function saveSetting(key, value) {
      settings[key] = value;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch {}
    }

    saveSetting("chatId", chatId);

    const on = (id, handler) =>
      $(id)?.addEventListener("click", handler);

    function status(am, en, type = "info", target = $("voiceStatus")) {
      const text = language === "am" ? am : en;

      if (target) {
        target.textContent = text;
        target.className = `voice-status ${type}`;
      }

      if ($("liveRegion")) $("liveRegion").textContent = text;
    }

    function busy(button, enabled) {
      if (!button) return;
      button.disabled = enabled;

      if (enabled) button.setAttribute("aria-busy", "true");
      else button.removeAttribute("aria-busy");
    }

    function detectLanguage(text) {
      if (ETHIOPIC.test(text)) return "am";
      if (/[A-Za-z]/.test(text)) return "en";
      return language;
    }

    /* =====================================================
       NORMALIZATION
       The user's original question is never overwritten.
       ===================================================== */

    function normalizeQuestion(text) {
      return String(text)
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/[’‘]/g, "'")
        .replace(/\be[\s-]?mail\b/g, "email")
        .replace(/[፠-፨?!.,;:'"“”()[\]{}]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    /* =====================================================
       BILINGUAL SAMPLE LESSONS
       Replace with your approved course material as needed.
       No invented page numbers or textbook citations.
       ===================================================== */

    function lesson(id, questions, am, en, title) {
      return {
        id,
        questions,
        am,
        en,
        source: `Built-in sample lesson: ${title}`
      };
    }

    const lessons = [
      lesson(
        "downloading",
        [
          "What is downloading?",
          "What does downloading mean?",
          "Define downloading",
          "Explain downloading",
          "ማውረድ ምንድን ነው?",
          "ማውረድ ምን ማለት ነው?",
          "ዳውንሎድ ምንድን ነው?",
          "ዳውንሎድ ምን ማለት ነው?",
          "ፋይል ማውረድ ምንድን ነው?",
          "ስለ ማውረድ አብራራልኝ"
        ],
        "ማውረድ ማለት ፋይልን ከኢንተርኔት ወይም ከሌላ የመረብ መሣሪያ ወደ ስልክዎ ወይም ኮምፒውተርዎ መቀበልና ማስቀመጥ ማለት ነው።",
        "Downloading means receiving and saving a file from the internet or another network device onto your phone or computer.",
        "Downloading"
      ),

      lesson(
        "uploading",
        [
          "What is uploading?",
          "Define uploading",
          "What does uploading mean?",
          "ፋይል መስቀል ምንድን ነው?",
          "መስቀል ምን ማለት ነው?",
          "አፕሎድ ምንድን ነው?",
          "አፕሎድ ምን ማለት ነው?"
        ],
        "ፋይል መስቀል ማለት ፋይልን ከስልክዎ ወይም ከኮምፒውተርዎ ወደ ድረ ገጽ፣ አገልጋይ ወይም ሌላ የመረብ መሣሪያ መላክ ማለት ነው።",
        "Uploading means sending a file from your phone or computer to a website, server, or another network device.",
        "Uploading"
      ),

      lesson(
        "email",
        [
          "What is email?",
          "What is an email?",
          "Define email",
          "Explain email",
          "ኢሜይል ምንድን ነው?",
          "ኢሜይል ምን ማለት ነው?",
          "ኢሜል ምንድን ነው?",
          "ኢሜል ምን ማለት ነው?",
          "ስለ ኢሜይል አብራራልኝ"
        ],
        "ኢሜይል በኢንተርኔት መልዕክቶችን ለመላክና ለመቀበል የሚያገለግል የኤሌክትሮኒክስ መልዕክት አገልግሎት ነው። ከመልዕክቱ ጋር ሰነዶችንና ምስሎችን ማያያዝ ይችላሉ።",
        "Email is an electronic messaging service used to send and receive messages over the internet. Documents and images can be attached to a message.",
        "Email"
      ),

      lesson(
        "internet",
        [
          "What is the internet?",
          "What is internet?",
          "Define internet",
          "ኢንተርኔት ምንድን ነው?",
          "ኢንተርኔት ምን ማለት ነው?",
          "ስለ ኢንተርኔት አብራራልኝ"
        ],
        "ኢንተርኔት በዓለም ዙሪያ ያሉ የኮምፒውተር መረቦችን የሚያገናኝ ትልቅ መረብ ነው። ድረ ገጾችን ለመክፈት፣ መልዕክት ለመላክና መረጃ ለማጋራት ያገለግላል።",
        "The internet is a global network connecting computer networks. It supports services such as websites, messaging, and information sharing.",
        "Internet Basics"
      ),

      lesson(
        "browser",
        [
          "What is a browser?",
          "What is a web browser?",
          "Define browser",
          "አሳሽ ምንድን ነው?",
          "የድር አሳሽ ምንድን ነው?",
          "ብሮውዘር ምንድን ነው?"
        ],
        "የድር አሳሽ ድረ ገጾችን ለመክፈትና ለማየት የሚያገለግል ፕሮግራም ነው። Chrome፣ Edge እና Firefox የድር አሳሽ ምሳሌዎች ናቸው።",
        "A web browser is a program used to open and view websites. Chrome, Edge, and Firefox are examples.",
        "Web Browsers"
      ),

      lesson(
        "file",
        [
          "What is a file?",
          "Define file",
          "ፋይል ምንድን ነው?",
          "ፋይል ምን ማለት ነው?"
        ],
        "ፋይል በመሣሪያ ላይ በስም የሚቀመጥ መረጃ ነው። ሰነድ፣ ምስል፣ ድምፅ ወይም ቪዲዮ ሊሆን ይችላል።",
        "A file is information stored on a device under a name. It may contain a document, image, audio, video, or other data.",
        "Files"
      ),

      lesson(
        "folder",
        [
          "What is a folder?",
          "Define folder",
          "ፎልደር ምንድን ነው?",
          "ፎልደር ምን ማለት ነው?"
        ],
        "ፎልደር ፋይሎችንና ሌሎች ፎልደሮችን በአንድ ቦታ ለማደራጀት የሚያገለግል ማከማቻ ነው።",
        "A folder is a container used to organize files and other folders.",
        "Folders"
      ),

      lesson(
        "password",
        [
          "What is a password?",
          "Define password",
          "የይለፍ ቃል ምንድን ነው?",
          "ፓስወርድ ምንድን ነው?"
        ],
        "የይለፍ ቃል ወደ መለያ ወይም መሣሪያ ለመግባት የሚያገለግል ሚስጥራዊ የፊደላት፣ የቁጥሮች ወይም የምልክቶች ቅደም ተከተል ነው።",
        "A password is a secret sequence of characters used to access an account or device.",
        "Passwords"
      ),

      lesson(
        "cv",
        [
          "What is a CV?",
          "What is a curriculum vitae?",
          "Define CV",
          "CV ምንድን ነው?",
          "ሲቪ ምንድን ነው?",
          "ሲቪ ምን ማለት ነው?"
        ],
        "ሲቪ ስለ ትምህርትዎ፣ ክህሎትዎና የሥራ ልምድዎ የሚገልጽ ሰነድ ነው። ለሥራ ሲያመለክቱ ብቃትዎን ለአሠሪው ለማሳየት ያገለግላል።",
        "A CV is a document describing your education, skills, and work experience. It helps show an employer your qualifications when applying for a job.",
        "CV Basics"
      ),

      lesson(
        "interview",
        [
          "What is a job interview?",
          "What is an interview?",
          "Explain a job interview",
          "የሥራ ቃለ መጠይቅ ምንድን ነው?",
          "የስራ ቃለ መጠይቅ ምንድን ነው?",
          "ቃለ መጠይቅ ምንድን ነው?",
          "ቃለ መጠይቅ ምን ማለት ነው?"
        ],
        "የሥራ ቃለ መጠይቅ አሠሪው ስለ ክህሎትዎ፣ ልምድዎና ለሥራው ብቁ ስለመሆንዎ የሚጠይቅበት ውይይት ነው።",
        "A job interview is a conversation in which an employer asks about your skills, experience, and suitability for a job.",
        "Job Interviews"
      ),

      lesson(
        "apply",
        [
          "How do I apply for a job?",
          "How can I apply for a job?",
          "How to apply for a job",
          "ለሥራ እንዴት ላመልክት?",
          "ለስራ እንዴት ላመልክት?",
          "ለሥራ እንዴት ማመልከት እችላለሁ?",
          "ለስራ እንዴት ማመልከት እችላለሁ?"
        ],
        "የሥራ ማስታወቂያውን ያንብቡ፣ መስፈርቶቹን ያረጋግጡ፣ ሲቪዎን ያዘጋጁ፣ ከተጠየቀ የማመልከቻ ደብዳቤ ያክሉ፣ ከመጨረሻው ቀን በፊትም ያመልክቱ።",
        "Read the advertisement, check the requirements, prepare your CV, include a cover letter if requested, and apply before the deadline.",
        "Job Applications"
      ),

      lesson(
        "interview-preparation",
        [
          "How do I prepare for an interview?",
          "How can I prepare for a job interview?",
          "ለቃለ መጠይቅ እንዴት ልዘጋጅ?",
          "ለሥራ ቃለ መጠይቅ እንዴት ልዘጋጅ?"
        ],
        "ስለ አሠሪውና ስለ ሥራው ያንብቡ፣ ሲቪዎን ይከልሱ፣ ለተለመዱ ጥያቄዎች መልስ ይለማመዱ፣ የሚጠይቋቸውን ጥያቄዎች ያዘጋጁ፣ ጊዜውንና ቦታውንም ያረጋግጡ።",
        "Learn about the employer and role, review your CV, practice answers to common questions, prepare your own questions, and confirm the interview time and location.",
        "Interview Preparation"
      )
    ];

    const lessonIndex = new Map();

    lessons.forEach(item => {
      item.questions.forEach(sample => {
        const key = normalizeQuestion(sample);

        if (lessonIndex.has(key) && lessonIndex.get(key).id !== item.id) {
          console.warn("Duplicate lesson question:", sample);
        } else {
          lessonIndex.set(key, item);
        }
      });
    });

    function localAnswer(text) {
      return lessonIndex.get(normalizeQuestion(text)) || null;
    }

    /* =====================================================
       NETWORK
       ===================================================== */

    async function api(
      path,
      { method = "GET", body, signal, timeout = 30000 } = {}
    ) {
      const controller = new AbortController();
      const abort = () => controller.abort();

      if (signal?.aborted) controller.abort();
      else signal?.addEventListener("abort", abort, { once: true });

      const timer = setTimeout(abort, timeout);

      try {
        const response = await fetch(`${CONFIG.apiBase}${path}`, {
          method,
          headers: body
            ? { "Content-Type": "application/json" }
            : undefined,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
          cache: "no-store"
        });

        const raw = await response.text();

        if (!response.ok) {
          console.error(
            `${method} ${path}: HTTP ${response.status}`,
            raw.slice(0, 1500)
          );

          const error = new Error(`HTTP ${response.status}`);
          error.status = response.status;
          throw error;
        }

        let data;
        try {
          data = raw.trim() ? JSON.parse(raw) : {};
        } catch {
          throw new Error("The API returned a non-JSON response.");
        }

        if (data.ok === false || data.success === false) {
          throw new Error("The server rejected the request.");
        }

        return data;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
      }
    }

    /* =====================================================
       ANSWERS
       ===================================================== */

    function extractLanguage(text, lang) {
      return String(text)
        .split(/\n\s*(?:Source\s*:|Source\s*\/|ምንጭ\s*:|📚)/i)[0]
        .split(/\n+/)
        .filter(line => {
          if (/^\s*(English|አማርኛ)\s*:?\s*$/i.test(line)) return false;

          return lang === "am"
            ? ETHIOPIC.test(line)
            : /[A-Za-z]/.test(line) && !ETHIOPIC.test(line);
        })
        .join("\n")
        .trim();
    }

    function normalizeAnswer(data) {
      const structured =
        data.answer && typeof data.answer === "object"
          ? data.answer
          : data;

      let am = String(structured.answerAm || structured.am || "").trim();
      let en = String(structured.answerEn || structured.en || "").trim();

      const raw = typeof data.answer === "string"
        ? data.answer
        : typeof data.response === "string"
          ? data.response
          : typeof data.text === "string"
            ? data.text
            : "";

      if (!am && !en && raw) {
        am = extractLanguage(raw, "am");
        en = extractLanguage(raw, "en");
      }

      if (!am && !en) {
        throw new Error("The API returned no readable answer.");
      }

      const source = data.source || data.citation || "";

      return {
        am,
        en,
        source: typeof source === "string" ? source : ""
      };
    }

    function displayAnswer(record, firstLanguage) {
      currentAnswer = record;

      const am = record.am ||
        "የአማርኛ ትርጉም ከአገልጋዩ አልተመለሰም።";

      const en = record.en ||
        "The server did not return an English translation.";

      const sections = firstLanguage === "am"
        ? [`አማርኛ\n${am}`, `English\n${en}`]
        : [`English\n${en}`, `አማርኛ\n${am}`];

      if (record.source) {
        sections.push(`Source / ምንጭ: ${record.source}`);
      }

      const oldScroll = question.scrollTop;

      answer.value = sections.join("\n\n");
      answer.style.removeProperty("height");
      answer.scrollTop = 0;
      answer.scrollLeft = 0;

      question.scrollTop = oldScroll;
    }

    function backendPayload(text) {
      const firstLanguage = detectLanguage(text);

      const payload = {
        chatId,
        question: text,
        language: firstLanguage,
        responseLanguages: [
          firstLanguage,
          firstLanguage === "am" ? "en" : "am"
        ]
      };

      const lessonId = $("lessonSelect")?.value;
      if (lessonId) payload.lessonId = lessonId;

      return payload;
    }

    async function getAnswer() {
      stopReading();
      stopMicrophone();

      const text = question.value.trim();
      const firstLanguage = detectLanguage(text);
      const version = ++requestVersion;

      answerController?.abort();
      answerController = null;
      busy($("getAnswerBtn"), false);

      if (!text || text.length > 6000) {
        status(
          "ከ1 እስከ 6000 ቁምፊዎች ያለውን ጥያቄ ይጻፉ።",
          "Enter a question between 1 and 6,000 characters.",
          "warn"
        );
        question.focus({ preventScroll: true });
        return;
      }

      const local = localAnswer(text);

      if (local) {
        displayAnswer(local, firstLanguage);

        status(
          "መልሱ ከተካተተው የትምህርት ምሳሌ ተገኝቷል።",
          "Answer found in the built-in sample lessons.",
          "ok"
        );
        return;
      }

      currentAnswer = null;
      answer.value =
        "መልስ ከአገልጋዩ እየተጠየቀ ነው...\n\nRequesting an answer...";
      answer.scrollTop = 0;
      busy($("getAnswerBtn"), true);

      const controller = new AbortController();
      answerController = controller;

      try {
        const data = await api(CONFIG.answerPath, {
          method: "POST",
          body: backendPayload(text),
          signal: controller.signal
        });

        if (version !== requestVersion) return;

        const record = normalizeAnswer(data);
        displayAnswer(record, firstLanguage);

        status(
          "መልሱ ከአገልጋዩ ተመልሷል።",
          "The server returned an answer.",
          record.am && record.en ? "ok" : "warn"
        );
      } catch (error) {
        if (version !== requestVersion) return;

        const am = error.status === 404
          ? "የመልስ አገልጋዩ መንገድ አልተገኘም። የRailway API አድራሻና መንገድ ያረጋግጡ።"
          : "ከአገልጋዩ መልስ ማግኘት አልተቻለም። እንደገና ይሞክሩ ወይም እርዳታ ይጠይቁ።";

        const en = error.status === 404
          ? "The answer API route was not found. Verify the Railway URL and actual POST route."
          : "The answer service could not complete the request. Try again or use I Need Help.";

        displayAnswer({ am, en, source: "" }, firstLanguage);

        status(
          "ዝርዝሩን በConsole ይመልከቱ።",
          "See the console and Railway logs for details.",
          "warn"
        );

        console.error("Answer request failed:", error);
      } finally {
        if (version === requestVersion) {
          answerController = null;
          busy($("getAnswerBtn"), false);
        }
      }
    }

    on("getAnswerBtn", getAnswer);

    question.addEventListener("keydown", event => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key === "Enter" &&
        !$("getAnswerBtn")?.disabled
      ) {
        event.preventDefault();
        getAnswer();
      }
    });

    /* =====================================================
       BUTTONS / INTERFACE
       ===================================================== */

    const labels = {
      am: {
        getAnswerBtn: "መልስ አግኝ",
        clearBtn: "አጽዳ",
        copyBtn: "ጥያቄውን ቅዳ",
        helpBtn: "እርዳታ አስፈልገኛል",
        screenShareBtn: "የስብሰባ ሊንክ ላክ",
        downloadBtn: "አውርድ",
        readAm: "አማርኛ አንብብ",
        readEn: "English አንብብ",
        micAm: "በአማርኛ ተናገር",
        micEn: "በእንግሊዝኛ ተናገር",
        stop: "አቁም",
        listening: "እያዳመጥኩ ነው..."
      },
      en: {
        getAnswerBtn: "Get Answer",
        clearBtn: "Clear",
        copyBtn: "Copy Question",
        helpBtn: "I Need Help",
        screenShareBtn: "Send Meeting Link",
        downloadBtn: "Download",
        readAm: "Read Amharic",
        readEn: "Read English",
        micAm: "Speak Amharic",
        micEn: "Speak English",
        stop: "Stop",
        listening: "Listening..."
      }
    };

    function updateMediaButtons() {
      const t = labels[language];

      [
        ["speakAmharicBtn", readingLanguage === "am", t.readAm, false],
        ["speakEnglishBtn", readingLanguage === "en", t.readEn, false],
        ["voiceAmharicBtn", microphone?.lang === "am", t.micAm, true],
        ["voiceEnglishBtn", microphone?.lang === "en", t.micEn, true]
      ].forEach(([id, enabled, normal, isMic]) => {
        const button = $(id);
        if (!button) return;

        button.textContent = enabled
          ? isMic ? t.listening : t.stop
          : normal;

        button.setAttribute("aria-pressed", String(enabled));
      });
    }

    function updateConnection() {
      let badge = $("netBadge");

      if (!badge) {
        badge = document.createElement("p");
        badge.id = "netBadge";
        badge.setAttribute("role", "status");
        $("main")?.prepend(badge);
      }

      const online = navigator.onLine !== false;

      badge.textContent = language === "am"
        ? online ? "ግንኙነት አለ" : "ከመስመር ውጭ"
        : online ? "Online" : "Offline";

      badge.style.color =
        document.body.classList.contains("high-contrast")
          ? "#ffd166"
          : online ? "#176139" : "#a32222";
    }

    function updateLanguage() {
      const t = labels[language];
      document.documentElement.lang = language;

      Object.keys(t).forEach(id => {
        if ($(id)) $(id).textContent = t[id];
      });

      const qLabel = document.querySelector('label[for="question"]');
      const aLabel = document.querySelector('label[for="answer"]');

      if (qLabel) qLabel.textContent =
        language === "am" ? "ጥያቄዎን ይጻፉ" : "Ask your question";

      if (aLabel) aLabel.textContent =
        language === "am" ? "መልስ" : "Answer";

      question.placeholder = language === "am"
        ? "ለምሳሌ፦ ኢሜይል ምንድን ነው?"
        : "Example: What is email?";

      answer.placeholder = language === "am"
        ? "መልሱ እዚህ ይታያል..."
        : "Your answer will appear here...";

      updateMediaButtons();
      updateConnection();
    }

    document.querySelectorAll("button").forEach(button => {
      button.classList.remove("active-primary", "button-flash");

      button.addEventListener("click", () => {
        document.querySelectorAll("button.active-primary")
          .forEach(item => item.classList.remove("active-primary"));

        if (button.id === "getAnswerBtn") return;

        button.classList.add("active-primary");
        button.classList.remove("button-flash");
        void button.offsetWidth;
        button.classList.add("button-flash");

        setTimeout(
          () => button.classList.remove("button-flash"),
          650
        );
      });
    });

    function applyFont() {
      question.style.fontSize = `${fontSize}rem`;
      answer.style.fontSize = `${fontSize}rem`;
      saveSetting("fontSize", fontSize);
    }

    on("languageToggleBtn", () => {
      language = language === "am" ? "en" : "am";
      saveSetting("language", language);
      updateLanguage();
    });

    on("fontSmall", () => {
      fontSize = Math.max(0.9, fontSize - 0.08);
      applyFont();
    });

    on("fontNormal", () => {
      fontSize = 1.05;
      applyFont();
    });

    on("fontLarge", () => {
      fontSize = Math.min(1.8, fontSize + 0.08);
      applyFont();
    });

    on("contrastBtn", () => {
      const enabled =
        document.body.classList.toggle("high-contrast");

      saveSetting("highContrast", enabled);
      $("contrastBtn")?.setAttribute("aria-pressed", String(enabled));
      updateConnection();
    });

    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);

    /* =====================================================
       SINGLE READING CONTROLLER
       ===================================================== */

    function stopReading() {
      speechVersion++;
      readingLanguage = null;

      speechController?.abort();
      speechController = null;

      const cancel = speechCancel;
      speechCancel = null;
      cancel?.();

      if (activeUtterance) {
        activeUtterance.onend = null;
        activeUtterance.onerror = null;
        activeUtterance = null;
      }

      try { window.speechSynthesis?.cancel(); } catch {}

      if (activeAudio) {
        activeAudio.pause();
        activeAudio.removeAttribute("src");
        activeAudio.load();
        activeAudio = null;
      }

      updateMediaButtons();
    }

    function chooseVoice(voices, lang) {
      const preferred = lang === "am"
        ? ["Ameha"]
        : ["David", "Mark", "Guy", "Ryan", "George", "Daniel"];

      const score = voice => {
        let value = voice.localService ? 2 : 0;

        preferred.forEach((name, index) => {
          if (voice.name.toLowerCase().includes(name.toLowerCase())) {
            value += 100 - index;
          }
        });

        return value;
      };

      return voices.filter(voice => {
        const code = voice.lang.toLowerCase().replace(/_/g, "-");
        return code === lang || code.startsWith(`${lang}-`);
      }).sort((a, b) => score(b) - score(a))[0] || null;
    }

    function waitForVoices(run, lang) {
      return new Promise(resolve => {
        const synth = window.speechSynthesis;
        if (!synth) {
          resolve([]);
          return;
        }

        let done = false;
        let timer;

        function finish(voices) {
          if (done) return;
          done = true;
          clearTimeout(timer);
          synth.removeEventListener("voiceschanged", check);
          if (speechCancel === cancel) speechCancel = null;
          resolve(voices);
        }

        function cancel() { finish([]); }

        function check() {
          if (run !== speechVersion) return finish([]);
          const voices = synth.getVoices();
          if (chooseVoice(voices, lang)) finish(voices);
        }

        speechCancel = cancel;
        synth.addEventListener("voiceschanged", check);

        timer = setTimeout(
          () => finish(run === speechVersion ? synth.getVoices() : []),
          1200
        );

        check();
      });
    }

    function makeChunks(text, limit = 170) {
      const sentences = String(text)
        .replace(/https?:\/\/\S+/g, "")
        .replace(/[*#`]/g, "")
        .match(/[^.!?።፧\n]+[.!?።፧]?/g) || [];

      const output = [];

      for (const sentence of sentences) {
        let chunk = "";

        for (let word of sentence.trim().split(/\s+/)) {
          if (chunk && `${chunk} ${word}`.length > limit) {
            output.push(chunk);
            chunk = "";
          }

          while (word.length > limit) {
            output.push(word.slice(0, limit));
            word = word.slice(limit);
          }

          if (word) chunk = chunk ? `${chunk} ${word}` : word;
        }

        if (chunk) output.push(chunk);
      }

      return output;
    }

    function speakChunk(text, voice, lang, run) {
      return new Promise((resolve, reject) => {
        if (run !== speechVersion) return resolve(false);

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = voice;
        utterance.lang = lang === "am" ? "am-ET" : "en-US";
        utterance.rate = lang === "am" ? 0.85 : 0.88;
        utterance.pitch = 0.94;
        utterance.volume = 0.8;

        let done = false;

        function finish(error, completed = true) {
          if (done) return;
          done = true;
          clearTimeout(timer);
          utterance.onend = null;
          utterance.onerror = null;

          if (activeUtterance === utterance) activeUtterance = null;
          if (speechCancel === cancel) speechCancel = null;

          error ? reject(error) : resolve(completed);
        }

        function cancel() { finish(null, false); }

        const timer = setTimeout(() => {
          finish(new Error("Reading timed out."));
          try { window.speechSynthesis.cancel(); } catch {}
        }, 60000);

        utterance.onend = () => finish(null, true);

        utterance.onerror = event => {
          if (
            run !== speechVersion ||
            ["canceled", "interrupted"].includes(event.error)
          ) finish(null, false);
          else finish(new Error(event.error || "Speech failed."));
        };

        activeUtterance = utterance;
        speechCancel = cancel;

        try {
          window.speechSynthesis.speak(utterance);
        } catch (error) {
          finish(error);
        }
      });
    }

    async function playAudio(source, run) {
      if (run !== speechVersion) return false;

      const player = new Audio();
      player.volume = 0.8;
      activeAudio = player;

      try {
        return await new Promise((resolve, reject) => {
          let done = false;

          function finish(error, completed = true) {
            if (done) return;
            done = true;
            clearTimeout(timer);
            player.onended = null;
            player.onerror = null;

            if (speechCancel === cancel) speechCancel = null;
            error ? reject(error) : resolve(completed);
          }

          function cancel() {
            player.pause();
            finish(null, false);
          }

          const timer = setTimeout(() => {
            player.pause();
            finish(new Error("Online audio timed out."));
          }, 120000);

          speechCancel = cancel;
          player.onended = () => finish(null, true);
          player.onerror = () =>
            finish(new Error("Online audio was unavailable or blocked."));

          if (run !== speechVersion) return cancel();

          player.src = source;
          player.play().catch(error => finish(error));
        });
      } finally {
        player.pause();
        player.removeAttribute("src");
        player.load();
        if (activeAudio === player) activeAudio = null;
      }
    }

    async function googleSpeech(text, lang, run) {
      for (const chunk of makeChunks(text)) {
        if (run !== speechVersion) return;

        const url = new URL(
          "https://translate.google.com/translate_tts"
        );

        url.searchParams.set("ie", "UTF-8");
        url.searchParams.set("client", "tw-ob");
        url.searchParams.set("tl", lang);
        url.searchParams.set("q", chunk);

        const completed = await playAudio(url.href, run);
        if (!completed || run !== speechVersion) return;
      }
    }

    async function serverSpeech(text, lang, run) {
      const controller = new AbortController();
      speechController = controller;

      let objectURL;
      const timer = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch(
          `${CONFIG.apiBase}${CONFIG.speechPath}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text,
              language: lang === "am" ? "am-ET" : "en-US"
            }),
            signal: controller.signal
          }
        );

        if (
          !response.ok ||
          !response.headers.get("Content-Type")
            ?.toLowerCase().startsWith("audio/")
        ) throw new Error("Speech endpoint did not return audio.");

        const blob = await response.blob();
        if (run !== speechVersion) return;

        objectURL = URL.createObjectURL(blob);
        await playAudio(objectURL, run);
      } finally {
        clearTimeout(timer);
        if (speechController === controller) speechController = null;
        if (objectURL) URL.revokeObjectURL(objectURL);
      }
    }

    async function readAloud(lang) {
      const same = readingLanguage === lang;
      stopReading();
      if (same) return;

      stopMicrophone();

      const text = currentAnswer
        ? String(currentAnswer[lang] || "").trim()
        : extractLanguage(answer.value, lang);

      if (!text) {
        status(
          "በተመረጠው ቋንቋ የመልስ ጽሑፍ የለም።",
          `There is no ${lang === "am" ? "Amharic" : "English"} answer text.`,
          "warn"
        );
        return;
      }

      const run = speechVersion;
      readingLanguage = lang;
      updateMediaButtons();

      try {
        const voices = await waitForVoices(run, lang);
        if (run !== speechVersion) return;

        const voice = chooseVoice(voices, lang);

        if (voice) {
          for (const chunk of makeChunks(text)) {
            if (run !== speechVersion) return;
            const completed = await speakChunk(chunk, voice, lang, run);
            if (!completed || run !== speechVersion) return;
          }
        } else if (CONFIG.speechPath) {
          await serverSpeech(text, lang, run);
        } else if (
          CONFIG.googleSpeechFallback &&
          navigator.onLine !== false
        ) {
          status(
            "የመስመር ላይ የንባብ አገልግሎት እየተሞከረ ነው...",
            "Trying online speech. Answer text will be sent to Google."
          );
          await googleSpeech(text, lang, run);
        } else {
          status(
            "ለዚህ ቋንቋ የንባብ ድምፅ አልተገኘም።",
            "No matching reading voice is available.",
            "warn"
          );
        }
      } catch (error) {
        if (run !== speechVersion) return;

        try { window.speechSynthesis?.cancel(); } catch {}
        activeAudio?.pause();

        status(
          "የድምፅ ንባቡ አልተሳካም።",
          "Reading was unavailable. Check the device voice or speech service.",
          "warn"
        );
        console.warn("Reading failed:", error.message);
      } finally {
        if (run === speechVersion) {
          readingLanguage = null;
          updateMediaButtons();
        }
      }
    }

    on("speakAmharicBtn", () => readAloud("am"));
    on("speakEnglishBtn", () => readAloud("en"));

    /* =====================================================
       MICROPHONE / BEEPS
       ===================================================== */

    function unlockAudio() {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;

      try {
        audioContext ||= new Context();
        audioContext.resume().catch(() => {});
      } catch {}
    }

    function beep(startTone) {
      if (audioContext?.state !== "running") return;

      try {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const now = audioContext.currentTime;

        osc.type = "sine";
        osc.frequency.setValueAtTime(startTone ? 620 : 820, now);
        osc.frequency.exponentialRampToValueAtTime(
          startTone ? 820 : 580, now + 0.16
        );

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.045, now + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };

        osc.start(now);
        osc.stop(now + 0.2);
      } catch {}
    }

    function finishMicrophone(session) {
      if (session.finished) return;
      session.finished = true;

      if (session.started) beep(false);
      if (microphone === session) microphone = null;
      updateMediaButtons();
    }

    function stopMicrophone() {
      const session = microphone;
      if (!session) return;

      microphone = null;
      session.recognizer.onresult = null;
      try { session.recognizer.abort(); } catch {}
      finishMicrophone(session);
    }

    function startMicrophone(lang) {
      const previous = microphone?.lang;
      stopMicrophone();
      if (previous === lang) return;

      stopReading();
      unlockAudio();

      const Recognizer =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!Recognizer) {
        status(
          "የድምፅ ግብዓት አይገኝም። እባክዎ ይጻፉ።",
          "Voice input is unavailable. Please type.",
          "warn"
        );
        return;
      }

      const recognizer = new Recognizer();
      const session = {
        recognizer, lang, started: false, finished: false
      };

      microphone = session;
      recognizer.lang = lang === "am" ? "am-ET" : "en-US";
      recognizer.continuous = false;
      recognizer.interimResults = false;

      recognizer.onstart = () => {
        if (microphone !== session) {
          try { recognizer.abort(); } catch {}
          return;
        }

        session.started = true;
        beep(true);
        updateMediaButtons();
        status("እባክዎ ይናገሩ።", "Listening. Please speak.");
      };

      recognizer.onresult = event => {
        if (microphone !== session) return;

        const text = Array.from(event.results)
          .map(result => result[0].transcript)
          .join(" ").trim();

        question.value = [
          question.value.trim(), text
        ].filter(Boolean).join(" ");

        status(
          "ጥያቄዎ ተጽፏል። መልስ አግኝ ይጫኑ።",
          "Your words were added. Press Get Answer.",
          "ok"
        );
      };

      recognizer.onerror = event => {
        if (microphone === session && event.error !== "aborted") {
          status(
            "የድምፅ ግብዓት አልተሳካም።",
            `Microphone error: ${event.error}.`,
            "warn"
          );
        }
      };

      recognizer.onend = () => finishMicrophone(session);
      updateMediaButtons();

      try {
        recognizer.start();
      } catch {
        finishMicrophone(session);
        status(
          "ማይክሮፎኑን መጀመር አልተቻለም።",
          "The microphone could not start.",
          "warn"
        );
      }
    }

    on("voiceAmharicBtn", () => startMicrophone("am"));
    on("voiceEnglishBtn", () => startMicrophone("en"));

    /* =====================================================
       CLEAR / COPY / TELEGRAM
       ===================================================== */

    on("clearBtn", () => {
      requestVersion++;
      answerController?.abort();
      answerController = null;

      question.value = "";
      answer.value = "";
      question.scrollTop = 0;
      answer.scrollTop = 0;
      answer.style.removeProperty("height");

      currentAnswer = null;
      copiedQuestion = "";

      stopReading();
      stopMicrophone();
      busy($("getAnswerBtn"), false);

      status("ጽሑፉ ተጽድቷል።", "Question and answer cleared.");
      question.focus({ preventScroll: true });
    });

    async function copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    }

    on("copyBtn", async () => {
      const text = question.value.trim();

      if (!text) {
        status(
          "መጀመሪያ ጥያቄ ይጻፉ።",
          "Please type a question first.",
          "warn"
        );
        return;
      }

      copiedQuestion = text;
      const copied = await copyText(text);

      status(
        copied ? "ጥያቄው ተቀድቷል።" : "ጥያቄው ለእርዳታ ተዘጋጅቷል።",
        copied
          ? "Question copied."
          : "Saved for Help, but clipboard access was unavailable.",
        copied ? "ok" : "warn"
      );
    });

    function telegramHandoff(text, container) {
      const url = new URL(CONFIG.telegram);
      url.searchParams.set("text", text);

      let opened = false;

      try {
        const popup = window.open("about:blank", "_blank");
        if (popup) {
          popup.opener = null;
          popup.location.replace(url.href);
          opened = true;
        }
      } catch {}

      container?.querySelector(".telegram-handoff")?.remove();

      const panel = document.createElement("div");
      panel.className = "telegram-handoff privacy-note";

      const note = document.createElement("p");
      note.textContent =
        "If Telegram does not show the draft, copy this message, paste it into the bot, and press Send.";

      const draft = document.createElement("textarea");
      draft.value = text;
      draft.readOnly = true;
      draft.rows = 4;
      draft.setAttribute("aria-label", "Telegram message");

      const copy = document.createElement("button");
      copy.type = "button";
      copy.textContent = "Copy message";
      copy.addEventListener("click", async () => {
        if (await copyText(text)) copy.textContent = "Copied";
        else {
          draft.focus({ preventScroll: true });
          draft.select();
          copy.textContent = "Select and copy";
        }
      });

      const link = document.createElement("a");
      link.href = url.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "course-link";
      link.textContent = "Open Telegram";

      panel.append(note, draft, copy, document.createTextNode(" "), link);
      container?.append(panel);

      return opened;
    }

    on("helpBtn", () => {
      stopReading();
      stopMicrophone();

      const text = question.value.trim() || copiedQuestion;

      telegramHandoff(
        text
          ? `Learning support request\n\nQuestion:\n${text}`
          : "Hello, I need learning support.",
        $("helpBtn").closest(".answer-box")
      );
    });

    /* =====================================================
       FORMS
       ===================================================== */

    function createFormStatus(form) {
      if (!form) return null;
      const node = document.createElement("p");
      node.className = "voice-status";
      node.setAttribute("role", "status");
      form.insertAdjacentElement("afterend", node);
      return node;
    }

    function clearForm(form) {
      form.reset();

      form.querySelectorAll("input, textarea, select").forEach(field => {
        if (field instanceof HTMLSelectElement) field.selectedIndex = 0;
        else if (["checkbox", "radio"].includes(field.type)) {
          field.checked = false;
        } else if (!["hidden", "submit", "button"].includes(field.type)) {
          field.value = "";
        }
      });
    }

    const value = id => $(id)?.value.trim() || "";
    const validPhone = phone =>
      !phone || /^[+\d\s()-]{7,25}$/.test(phone);

    async function submitSupport({
      form, button, path, payload, message, target
    }) {
      if (form.dataset.busy === "true") return;
      form.dataset.busy = "true";
      busy(button, true);

      const opened = telegramHandoff(message, form.parentElement);
      if (opened) clearForm(form);

      status(
        "ጥያቄዎ እየተላከ ነው...",
        "Submitting your request...",
        "info",
        target
      );

      try {
        await api(path, {
          method: "POST",
          body: { chatId, ...payload, source: "web" }
        });

        clearForm(form);
        status(
          "አገልጋዩ ጥያቄዎን ተቀብሏል።",
          "The server accepted your request. Review the Telegram draft before sending.",
          "ok",
          target
        );
      } catch {
        status(
          "በአገልጋዩ ላይ መቀመጡ አልተረጋገጠም። Telegram ይጠቀሙ።",
          "Server submission was not confirmed. Use the Telegram draft.",
          "warn",
          target
        );
      } finally {
        delete form.dataset.busy;
        busy(button, false);
      }
    }

    const jobForm = $("jobAlertForm");
    const jobNotice = createFormStatus(jobForm);

    jobForm?.addEventListener("submit", event => {
      event.preventDefault();

      const phone = value("jobPhone");
      const telegram = value("jobTelegram");
      const area = value("jobArea");

      if ((!phone && !telegram) || !area || !validPhone(phone)) {
        status(
          "ስልክ ወይም Telegram ስም ያስገቡ፣ የሥራ መስክም ይምረጡ።",
          "Enter a valid contact and select a job area.",
          "warn", jobNotice
        );
        return;
      }

      submitSupport({
        form: jobForm,
        button: $("jobAlertBtn"),
        path: "/api/job-alert",
        target: jobNotice,
        payload: { phone, telegram, area, notify: true },
        message:
          `Job alert request\nPhone: ${phone || "Not provided"}\n` +
          `Telegram: ${telegram || "Not provided"}\nJob area: ${area}`
      });
    });

    const interviewForm = $("accommodationForm");
    const interviewNotice = createFormStatus(interviewForm);

    interviewForm?.addEventListener("submit", event => {
      event.preventDefault();

      const name = value("accommodationName");
      const phone = value("accommodationPhone");
      const type = value("accommodationType");
      const details = value("accommodationDetails");

      if (!name || !phone || !type || !validPhone(phone)) {
        status(
          "ስም፣ ትክክለኛ ስልክና የድጋፍ ዓይነት ያስገቡ።",
          "Enter your name, valid phone number, and support type.",
          "warn", interviewNotice
        );
        return;
      }

      submitSupport({
        form: interviewForm,
        button: $("accommodationBtn"),
        path: "/api/accommodation",
        target: interviewNotice,
        payload: { name, phone, type, details, status: "requested" },
        message:
          `Interview support request\nName: ${name}\nPhone: ${phone}\n` +
          `Support: ${type}\nDetails: ${details || "Not provided"}`
      });
    });

    /* =====================================================
       MEETING / DOWNLOAD / TEACHER VIEW
       ===================================================== */

    on("screenShareBtn", () => {
      const input = window.prompt(
        "Enter an HTTPS meeting link. This does not share your screen automatically."
      );

      if (!input?.trim()) return;

      let meetingLink;
      try {
        const url = new URL(input.trim());
        if (url.protocol !== "https:") throw new Error();
        meetingLink = url.href;
      } catch {
        status(
          "ትክክለኛ HTTPS ሊንክ ያስገቡ።",
          "Enter a valid HTTPS meeting link.",
          "warn"
        );
        return;
      }

      if (!window.confirm(`Send this link to support?\n${meetingLink}`)) {
        return;
      }

      telegramHandoff(
        `Meeting support request\n\n${meetingLink}`,
        $("screenShareBtn").closest(".answer-box")
      );

      api("/api/screen-share", {
        method: "POST",
        body: { chatId, meetingLink, source: "web" }
      }).then(() => {
        status(
          "አገልጋዩ ሊንኩን ተቀብሏል።",
          "The server accepted your meeting link.",
          "ok"
        );
      }).catch(() => {
        status(
          "በአገልጋዩ ላይ መቀመጡ አልተረጋገጠም።",
          "Server submission was not confirmed. Use Telegram.",
          "warn"
        );
      });
    });

    on("downloadBtn", () => {
      const text =
        `Learning and Employment / ትምህርት እና ሥራ\n\n` +
        `Question:\n${question.value}\n\nAnswer:\n${answer.value}`;

      const url = URL.createObjectURL(new Blob(["\uFEFF", text], {
        type: "text/plain;charset=utf-8"
      }));

      const link = document.createElement("a");
      link.href = url;
      link.download = "learning-and-employment.txt";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });

    async function loadTeacherStats() {
      const container = $("teacherStats");
      if (!container) return;

      try {
        const data = await api("/api/teacher-stats");
        const questions = Array.isArray(data.questions)
          ? data.questions.slice(0, 30)
          : [];

        container.replaceChildren();

        if (!questions.length) {
          container.textContent = "No questions available yet.";
          return;
        }

        const list = document.createElement("ol");
        questions.forEach(item => {
          const row = document.createElement("li");
          row.textContent =
            `${String(item.question || "")} — ${Number(item.count) || 0}`;
          list.append(row);
        });
        container.append(list);
      } catch {
        container.textContent =
          "Teacher statistics are unavailable or require authorization.";
      }
    }

    /* =====================================================
       MATCHING AND BACKEND TESTS
       ===================================================== */

    window.explainLessonMatch = text => {
      const normalized = normalizeQuestion(text);
      const matched = localAnswer(text);

      const result = {
        original: text,
        normalized,
        lessonId: matched?.id || null,
        nextStep: matched ? "Built-in lesson answer" : "Backend API",
        amharicAnswer: matched?.am || null,
        englishAnswer: matched?.en || null
      };

      console.table([result]);
      return result;
    };

    window.testLessonMatching = () => {
      const tests = [
        ["  ኢሜይል   ምንድን ነው፧ ", "email"],
        ["WHAT IS E-MAIL?!", "email"],
        ["ማውረድ ምን ማለት ነው?", "downloading"],
        ["  What is a CV? ", "cv"],
        ["ለስራ እንዴት ላመልክት?", "apply"],
        ["Why did my download fail?", null]
      ];

      const results = tests.map(([input, expected]) => {
        const actual = localAnswer(input)?.id || null;
        return {
          input,
          normalized: normalizeQuestion(input),
          expected,
          actual,
          passed: actual === expected
        };
      });

      console.table(results);
      return results;
    };

    /*
     * Explicit manual POST test.
     * It bypasses local matching and sends the question
     * to your configured backend.
     *
     * Backend logs are required to confirm Groq was invoked.
     */
    window.testBackendFallback = async (
      text = "ለመጀመሪያ የሥራ ቃለ መጠይቄ ሦስት የዝግጅት ምክሮችን ስጠኝ።"
    ) => {
      if (!String(text).trim()) {
        throw new Error("Provide a test question.");
      }

      console.info("Testing POST:", CONFIG.apiBase + CONFIG.answerPath);

      try {
        const raw = await api(CONFIG.answerPath, {
          method: "POST",
          body: backendPayload(String(text))
        });

        const record = normalizeAnswer(raw);

        const result = {
          httpRequestSucceeded: true,
          amharicPresent: Boolean(record.am),
          englishPresent: Boolean(record.en),
          source: record.source,
          groqInvocationVerified: false,
          note: "Check Railway logs to verify Groq invocation."
        };

        console.table([result]);
        console.log("Answer:", record);

        return { result, answer: record };
      } catch (error) {
        console.error("Backend fallback test failed:", error);

        return {
          httpRequestSucceeded: false,
          status: error.status || null,
          message: error.message,
          groqInvocationVerified: false
        };
      }
    };

    window.testWebsite = async () => {
      const results = [];

      [
        "question", "answer", "getAnswerBtn", "clearBtn",
        "copyBtn", "languageToggleBtn", "speakAmharicBtn",
        "speakEnglishBtn", "voiceAmharicBtn", "voiceEnglishBtn",
        "jobAlertForm", "accommodationForm"
      ].forEach(id => {
        const count = document.querySelectorAll(`[id="${id}"]`).length;
        results.push({
          test: `Unique #${id}`,
          passed: count === 1,
          details: `Found ${count}`
        });
      });

      const voices = window.speechSynthesis?.getVoices() || [];

      results.push({
        test: "Amharic device voice",
        passed: Boolean(chooseVoice(voices, "am")),
        details: "Online fallback may be used if unavailable."
      });

      results.push({
        test: "English device voice",
        passed: Boolean(chooseVoice(voices, "en")),
        details: ""
      });

      try {
        await api("/health", { timeout: 8000 });
        results.push({
          test: "Server health",
          passed: true,
          details: "Does not verify Groq or /api/ask."
        });
      } catch (error) {
        results.push({
          test: "Server health",
          passed: false,
          details: error.message
        });
      }

      console.table(results);
      return results;
    };

    /* =====================================================
       START / CLEANUP
       ===================================================== */

    document.body.classList.toggle(
      "high-contrast",
      settings.highContrast === true
    );

    $("contrastBtn")?.setAttribute(
      "aria-pressed",
      String(settings.highContrast === true)
    );

    applyFont();
    updateLanguage();
    loadTeacherStats();

    window.addEventListener("pagehide", () => {
      requestVersion++;
      answerController?.abort();
      stopReading();
      stopMicrophone();
    });

    console.info(
      `Loaded ${lessons.length} bilingual sample lessons and ` +
      `${lessonIndex.size} normalized question variants.`
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();