"use strict";

(() => {
  /*
   * Prevent this script from initializing twice.
   * Remove older inline scripts and other reading handlers too.
   */
  const APP_KEY = "__learningEmploymentApp";

  if (window[APP_KEY]) {
    console.warn("Learning app is already initialized.");
    return;
  }

  window[APP_KEY] = { initialized: false };

  function init() {
    if (window[APP_KEY].initialized) return;
    window[APP_KEY].initialized = true;

    /* ======================================================
       CONFIGURATION
       ====================================================== */

    const API_BASE =
      "https://learning-assistant-bot-production.up.railway.app";

    const TELEGRAM_URL = "https://t.me/EbaMengistuBot";

    const SETTINGS_KEY = "learning_settings_final";
    const CACHE_KEY = "learning_answers_final";

    const $ = id => document.getElementById(id);

    const ids = [
      "question",
      "answer",
      "getAnswerBtn",
      "clearBtn",
      "copyBtn",
      "languageToggleBtn",
      "speakAmharicBtn",
      "speakEnglishBtn",
      "voiceAmharicBtn",
      "voiceEnglishBtn",
      "contrastBtn",
      "fontSmall",
      "fontNormal",
      "fontLarge",
      "helpBtn",
      "screenShareBtn",
      "downloadBtn",
      "jobAlertForm",
      "jobAlertBtn",
      "accommodationForm",
      "accommodationBtn",
      "teacherStats",
      "liveRegion",
      "voiceStatus"
    ];

    const el = Object.fromEntries(ids.map(id => [id, $(id)]));

    if (!el.question || !el.answer) {
      console.error("Missing #question or #answer.");
      return;
    }

    const ETHIOPIC = /[\u1200-\u137f\u1380-\u139f\u2d80-\u2ddf]/;

    function readStorage(key, fallback) {
      try {
        const value = JSON.parse(localStorage.getItem(key));
        return value && typeof value === "object"
          ? value
          : fallback;
      } catch {
        return fallback;
      }
    }

    function writeStorage(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Storage is optional.
      }
    }

    const settings = readStorage(SETTINGS_KEY, {});

    let language = settings.language === "en" ? "en" : "am";

    let fontSize = Math.max(
      0.9,
      Math.min(1.8, Number(settings.fontSize) || 1.05)
    );

    const chatId =
      settings.chatId ||
      `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    settings.chatId = chatId;
    writeStorage(SETTINGS_KEY, settings);

    let copiedQuestion = "";
    let currentAnswer = null;
    let answerVersion = 0;
    let answerController = null;

    /* ======================================================
       HELPERS
       ====================================================== */

    function saveSetting(key, value) {
      settings[key] = value;
      writeStorage(SETTINGS_KEY, settings);
    }

    function announce(text) {
      if (el.liveRegion) {
        el.liveRegion.textContent = text;
      }
    }

    function status(am, en, type = "info", target = el.voiceStatus) {
      const text = language === "am" ? am : en;

      if (target) {
        target.textContent = text;
        target.className = `voice-status ${type}`;
      }

      announce(text);
    }

    function on(id, handler) {
      el[id]?.addEventListener("click", handler);
    }

    function detectLanguage(text) {
      if (ETHIOPIC.test(text)) return "am";
      if (/[A-Za-z]/.test(text)) return "en";
      return language;
    }

    function setBusy(button, busy) {
      if (!button) return;

      button.disabled = busy;

      if (busy) button.setAttribute("aria-busy", "true");
      else button.removeAttribute("aria-busy");
    }

    function makeFormStatus(form) {
      if (!form) return null;

      const node = document.createElement("p");
      node.className = "voice-status";
      node.setAttribute("role", "status");
      node.setAttribute("aria-live", "polite");

      form.insertAdjacentElement("afterend", node);
      return node;
    }

    const jobStatus = makeFormStatus(el.jobAlertForm);
    const accommodationStatus = makeFormStatus(el.accommodationForm);

    /* ======================================================
       BUTTON EFFECTS
       ====================================================== */

    document.querySelectorAll("button").forEach(button => {
      button.classList.remove("active-primary", "button-flash");

      button.addEventListener("click", () => {
        document.querySelectorAll("button.active-primary").forEach(
          item => item.classList.remove("active-primary")
        );

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

    /* ======================================================
       LANGUAGE / ACCESSIBILITY
       ====================================================== */

    const labels = {
      am: {
        question: "ጥያቄዎን ይጻፉ",
        answer: "መልስ",
        questionPlaceholder: "ለምሳሌ፦ ማውረድ ምን ማለት ነው?",
        answerPlaceholder: "መልሱ እዚህ ይታያል...",
        getAnswerBtn: "መልስ አግኝ",
        clearBtn: "አጽዳ",
        copyBtn: "ጥያቄውን ቅዳ",
        helpBtn: "እርዳታ አስፈልገኛል",
        screenShareBtn: "የስብሰባ ሊንክ ላክ",
        downloadBtn: "አውርድ",
        micAm: "በአማርኛ ተናገር",
        micEn: "በእንግሊዝኛ ተናገር",
        readAm: "አማርኛ አንብብ",
        readEn: "English አንብብ",
        stop: "አቁም",
        listening: "እያዳመጥኩ ነው..."
      },

      en: {
        question: "Ask your question",
        answer: "Answer",
        questionPlaceholder: "Example: What is downloading?",
        answerPlaceholder: "Your answer will appear here...",
        getAnswerBtn: "Get Answer",
        clearBtn: "Clear",
        copyBtn: "Copy Question",
        helpBtn: "I Need Help",
        screenShareBtn: "Send Meeting Link",
        downloadBtn: "Download",
        micAm: "Speak Amharic",
        micEn: "Speak English",
        readAm: "Read Amharic",
        readEn: "Read English",
        stop: "Stop",
        listening: "Listening..."
      }
    };

    function updateLanguage() {
      const t = labels[language];
      document.documentElement.lang = language;

      const qLabel = document.querySelector('label[for="question"]');
      const aLabel = document.querySelector('label[for="answer"]');

      if (qLabel) qLabel.textContent = t.question;
      if (aLabel) aLabel.textContent = t.answer;

      el.question.placeholder = t.questionPlaceholder;
      el.answer.placeholder = t.answerPlaceholder;

      [
        "getAnswerBtn",
        "clearBtn",
        "copyBtn",
        "helpBtn",
        "screenShareBtn",
        "downloadBtn"
      ].forEach(id => {
        if (el[id]) el[id].textContent = t[id];
      });

      updateMediaButtons();
      updateConnectionBadge();
    }

    function updateMediaButtons() {
      const t = labels[language];

      if (el.speakAmharicBtn) {
        el.speakAmharicBtn.textContent =
          readingLanguage === "am" ? t.stop : t.readAm;

        el.speakAmharicBtn.setAttribute(
          "aria-pressed",
          String(readingLanguage === "am")
        );
      }

      if (el.speakEnglishBtn) {
        el.speakEnglishBtn.textContent =
          readingLanguage === "en" ? t.stop : t.readEn;

        el.speakEnglishBtn.setAttribute(
          "aria-pressed",
          String(readingLanguage === "en")
        );
      }

      if (el.voiceAmharicBtn) {
        el.voiceAmharicBtn.textContent =
          recognitionSession?.lang === "am"
            ? t.listening
            : t.micAm;

        el.voiceAmharicBtn.setAttribute(
          "aria-pressed",
          String(recognitionSession?.lang === "am")
        );
      }

      if (el.voiceEnglishBtn) {
        el.voiceEnglishBtn.textContent =
          recognitionSession?.lang === "en"
            ? t.listening
            : t.micEn;

        el.voiceEnglishBtn.setAttribute(
          "aria-pressed",
          String(recognitionSession?.lang === "en")
        );
      }
    }

    function updateConnectionBadge() {
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

    function applyFont() {
      el.question.style.fontSize = `${fontSize}rem`;
      el.answer.style.fontSize = `${fontSize}rem`;
      saveSetting("fontSize", fontSize);
    }

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
      const enabled = document.body.classList.toggle("high-contrast");

      saveSetting("highContrast", enabled);
      el.contrastBtn.setAttribute("aria-pressed", String(enabled));
      updateConnectionBadge();
    });

    on("languageToggleBtn", () => {
      language = language === "am" ? "en" : "am";

      saveSetting("language", language);
      updateLanguage();

      status("አማርኛ ተመርጧል።", "English selected.");
    });

    window.addEventListener("online", updateConnectionBadge);
    window.addEventListener("offline", updateConnectionBadge);

    /* ======================================================
       NETWORK
       ====================================================== */

    async function request(
      path,
      { method = "GET", body, signal, timeout = 20000 } = {}
    ) {
      const controller = new AbortController();

      const abort = () => controller.abort();

      if (signal?.aborted) controller.abort();
      else signal?.addEventListener("abort", abort, { once: true });

      const timer = setTimeout(abort, timeout);

      try {
        const response = await fetch(`${API_BASE}${path}`, {
          method,
          headers: body
            ? { "Content-Type": "application/json" }
            : undefined,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const raw = await response.text();

        if (!raw.trim()) return {};

        let data;

        try {
          data = JSON.parse(raw);
        } catch {
          throw new Error("Server response was not JSON.");
        }

        if (data?.success === false || data?.ok === false) {
          throw new Error("The server rejected this request.");
        }

        return data;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
      }
    }

    /* ======================================================
       ANSWER DISPLAY — NO AUTOMATIC EXPANSION
       ====================================================== */

    function renderAnswer(record, firstLanguage) {
      currentAnswer = record;

      const first = firstLanguage === "am"
        ? record.am
        : record.en;

      const second = firstLanguage === "am"
        ? record.en
        : record.am;

      const parts = [first, second].filter(Boolean);

      if (record.source) {
        parts.push(`Source / ምንጭ: ${record.source}`);
      }

      const questionScroll = el.question.scrollTop;

      el.answer.value = parts.join("\n\n");
      el.answer.style.removeProperty("height");
      el.answer.scrollTop = 0;
      el.answer.scrollLeft = 0;

      el.question.scrollTop = questionScroll;

      announce(
        firstLanguage === "am"
          ? "መልሱ ዝግጁ ነው።"
          : "Your answer is ready."
      );
    }

    function displayMessage(am, en, firstLanguage = language) {
      renderAnswer({ am, en, source: "" }, firstLanguage);
    }

    /* ======================================================
       LOCAL BILINGUAL ANSWERS
       Sources are honestly labelled as built-in content.
       ====================================================== */

    const FAQ = [
      {
        match: q => /download|ማውረድ/.test(q),
        en: "Downloading means saving a file from the internet to your device.",
        am: "ማውረድ ማለት ፋይልን ከኢንተርኔት ወደ መሣሪያዎ ማስቀመጥ ማለት ነው።"
      },
      {
        match: q => /what is (?:an? )?e-?mail|ኢሜይል ምን/.test(q),
        en: "Email lets you send and receive electronic messages over the internet.",
        am: "ኢሜይል በኢንተርኔት የኤሌክትሮኒክስ መልዕክቶችን ለመላክና ለመቀበል ያገለግላል።"
      },
      {
        match: q => /what is a job interview|ቃለ መጠይቅ ምን/.test(q),
        en: "A job interview is a conversation in which an employer asks about your skills, experience, and suitability for a job.",
        am: "የሥራ ቃለ መጠይቅ አሠሪው ስለ ክህሎትዎ፣ ልምድዎና ለሥራው ብቁ ስለመሆንዎ የሚጠይቅበት ውይይት ነው።"
      },
      {
        match: q => /how (?:do|can) i apply for a job|ለሥራ እንዴት/.test(q),
        en: "Read the job advertisement, prepare your CV, include a cover letter if requested, and apply before the deadline.",
        am: "የሥራ ማስታወቂያውን ያንብቡ፣ CVዎን ያዘጋጁ፣ ከተጠየቀ የማመልከቻ ደብዳቤ ያክሉ፣ ከመጨረሻው ቀን በፊትም ያመልክቱ።"
      }
    ];

    function solveMath(question) {
      const text = question
        .toLowerCase()
        .replace(/^(what is|calculate|solve)\s+/, "")
        .replace(/[?፧]$/, "")
        .replace(/\bplus\b/g, "+")
        .replace(/\bminus\b/g, "-")
        .replace(/\btimes\b|×/g, "*")
        .replace(/\bdivided by\b|÷/g, "/")
        .replace(/\s+/g, "");

      if (
        text.length > 200 ||
        !/^[\d.+*/()-]+$/.test(text) ||
        !/[+*/-]/.test(text)
      ) return null;

      const tokens = text.match(/\d+(?:\.\d*)?|\.\d+|[()+*/-]/g);

      if (!tokens || tokens.join("") !== text) return null;

      let index = 0;

      function factor() {
        const token = tokens[index++];

        if (token === "+") return factor();
        if (token === "-") return -factor();

        if (token === "(") {
          const result = sum();
          if (tokens[index++] !== ")") throw new Error("Bracket");
          return result;
        }

        if (!token || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) {
          throw new Error("Number");
        }

        return Number(token);
      }

      function product() {
        let value = factor();

        while (tokens[index] === "*" || tokens[index] === "/") {
          const op = tokens[index++];
          const right = factor();
          value = op === "*" ? value * right : value / right;
        }

        return value;
      }

      function sum() {
        let value = product();

        while (tokens[index] === "+" || tokens[index] === "-") {
          const op = tokens[index++];
          const right = product();
          value = op === "+" ? value + right : value - right;
        }

        return value;
      }

      try {
        const result = sum();

        return index === tokens.length && Number.isFinite(result)
          ? Number(result.toPrecision(12))
          : null;
      } catch {
        return null;
      }
    }

    function localAnswer(question) {
      const math = solveMath(question);

      if (math !== null) {
        return {
          am: `መልሱ ${math} ነው።`,
          en: `The answer is ${math}.`,
          source: "Built-in arithmetic calculator"
        };
      }

      const item = FAQ.find(
        entry => entry.match(question.toLowerCase())
      );

      return item
        ? {
            am: item.am,
            en: item.en,
            source: "Built-in learning FAQ"
          }
        : null;
    }

    /*
     * Preferred /api/ask response:
     * {
     *   answerAm: "...",
     *   answerEn: "...",
     *   source: "..."
     * }
     *
     * Plain answer strings are also displayed, but the frontend
     * cannot invent a missing translation.
     */
    function normalizeAnswer(data) {
      const structured =
        data.answer && typeof data.answer === "object"
          ? data.answer
          : data;

      let am = String(
        structured.answerAm || structured.am || ""
      ).trim();

      let en = String(
        structured.answerEn || structured.en || ""
      ).trim();

      const raw =
        typeof data.answer === "string"
          ? data.answer
          : typeof data.response === "string"
            ? data.response
            : typeof data.text === "string"
              ? data.text
              : "";

      if (!am && !en && raw) {
        const blocks = raw.split(/\n\s*\n/);

        am = blocks.filter(block => ETHIOPIC.test(block)).join("\n\n");
        en = blocks.filter(
          block => /[A-Za-z]/.test(block) && !ETHIOPIC.test(block)
        ).join("\n\n");

        if (!am && !en) en = raw;
      }

      if (!am && !en) throw new Error("No answer text.");

      const sourceValue = data.source || data.citation || "";

      return {
        am,
        en,
        source: typeof sourceValue === "string" ? sourceValue : ""
      };
    }

    async function getAnswer() {
      stopReading();
      stopRecognition();

      const question = el.question.value.trim();
      const firstLanguage = detectLanguage(question);
      const version = ++answerVersion;

      answerController?.abort();
      answerController = null;
      setBusy(el.getAnswerBtn, false);

      if (!question) {
        displayMessage(
          "እባክዎ ጥያቄ ይጻፉ።",
          "Please type a question."
        );

        el.question.focus({ preventScroll: true });
        return;
      }

      const local = localAnswer(question);

      if (local) {
        renderAnswer(local, firstLanguage);
        return;
      }

      const cacheKey = `${firstLanguage}:${question.toLowerCase()}`;
      const cache = readStorage(CACHE_KEY, {});

      if (cache[cacheKey]?.answer) {
        renderAnswer(cache[cacheKey].answer, firstLanguage);
        return;
      }

      if (navigator.onLine === false) {
        displayMessage(
          "ይህ ጥያቄ ኢንተርኔት ያስፈልገዋል።",
          "This question needs an internet connection.",
          firstLanguage
        );

        return;
      }

      currentAnswer = null;
      el.answer.value = firstLanguage === "am"
        ? "እየፈለግሁ ነው..."
        : "Getting your answer...";

      el.answer.scrollTop = 0;
      setBusy(el.getAnswerBtn, true);

      const controller = new AbortController();
      answerController = controller;

      try {
        const data = await request("/api/ask", {
          method: "POST",
          signal: controller.signal,
          body: {
            chatId,
            question,
            language: firstLanguage,
            responseLanguages: [firstLanguage, firstLanguage === "am" ? "en" : "am"]
          }
        });

        if (version !== answerVersion) return;

        const record = normalizeAnswer(data);
        renderAnswer(record, firstLanguage);

        cache[cacheKey] = {
          answer: record,
          savedAt: Date.now()
        };

        const entries = Object.entries(cache)
          .sort((a, b) => b[1].savedAt - a[1].savedAt)
          .slice(0, 60);

        writeStorage(CACHE_KEY, Object.fromEntries(entries));

        if (!record.am || !record.en) {
          status(
            "አገልጋዩ በአንድ ቋንቋ ብቻ መልሷል።",
            "The server returned only one language.",
            "warn"
          );
        }
      } catch (error) {
        if (version !== answerVersion) return;

        displayMessage(
          "መልስ ማግኘት አልተቻለም። እንደገና ይሞክሩ ወይም እርዳታ ይጠይቁ።",
          "The answer service is unavailable. Try again or use I Need Help.",
          firstLanguage
        );

        console.warn("Answer request failed:", error.message);
      } finally {
        if (version === answerVersion) {
          answerController = null;
          setBusy(el.getAnswerBtn, false);
        }
      }
    }

    on("getAnswerBtn", getAnswer);

    el.question.addEventListener("keydown", event => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        if (!el.getAnswerBtn?.disabled) getAnswer();
      }
    });

    /* ======================================================
       ONE SPEECH CONTROLLER — NO COMPETING AUDIO FALLBACK
       ====================================================== */

    let speechRun = 0;
    let readingLanguage = null;
    let activeUtterance = null;
    let cancelSpeechWait = null;

    const speechSettings = {
      en: { locale: "en-US", rate: 0.88, pitch: 0.94, volume: 0.8 },
      am: { locale: "am-ET", rate: 0.85, pitch: 0.94, volume: 0.8 }
    };

    const preferredNames = {
      en: ["David", "Mark", "Guy", "Ryan", "George", "Daniel"],
      am: ["Ameha"]
    };

    function stopReading() {
      speechRun++;
      readingLanguage = null;

      const cancel = cancelSpeechWait;
      cancelSpeechWait = null;
      cancel?.();

      if (activeUtterance) {
        activeUtterance.onend = null;
        activeUtterance.onerror = null;
        activeUtterance = null;
      }

      try {
        window.speechSynthesis?.cancel();
      } catch {
        // Speech is unavailable.
      }

      updateMediaButtons();
    }

    function loadVoices(run) {
      return new Promise(resolve => {
        const synth = window.speechSynthesis;
        let finished = false;
        let timer;

        function finish(voices) {
          if (finished) return;
          finished = true;

          clearTimeout(timer);
          synth.removeEventListener("voiceschanged", check);

          if (cancelSpeechWait === cancel) {
            cancelSpeechWait = null;
          }

          resolve(voices);
        }

        function cancel() {
          finish([]);
        }

        function check() {
          if (run !== speechRun) {
            finish([]);
            return;
          }

          const voices = synth.getVoices();
          if (voices.length) finish(voices);
        }

        cancelSpeechWait = cancel;
        synth.addEventListener("voiceschanged", check);

        timer = setTimeout(
          () => finish(run === speechRun ? synth.getVoices() : []),
          1500
        );

        check();
      });
    }

    function chooseVoice(voices, lang) {
      function score(voice) {
        let value = voice.localService ? 3 : 0;
        const name = voice.name.toLowerCase();

        preferredNames[lang].forEach((preferred, index) => {
          if (name.includes(preferred.toLowerCase())) {
            value += 100 - index;
          }
        });

        if (
          voice.lang.toLowerCase().replace(/_/g, "-") ===
          speechSettings[lang].locale.toLowerCase()
        ) value += 10;

        return value;
      }

      return voices
        .filter(voice => {
          const code = voice.lang.toLowerCase().replace(/_/g, "-");
          return code === lang || code.startsWith(`${lang}-`);
        })
        .sort((a, b) => score(b) - score(a))[0] || null;
    }

    function readingText(lang) {
      if (currentAnswer) return currentAnswer[lang] || "";

      return el.answer.value
        .split(/\n\s*(?:Source|ምንጭ|📚)/i)[0]
        .split(/\n+/)
        .filter(line => lang === "am"
          ? ETHIOPIC.test(line)
          : /[A-Za-z]/.test(line) && !ETHIOPIC.test(line))
        .join("\n");
    }

    function speechChunks(text) {
      const sentences = text
        .replace(/https?:\/\/\S+/g, "")
        .replace(/[*#`]/g, "")
        .match(/[^.!?።፧\n]+[.!?።፧]?/g) || [];

      const output = [];

      for (const sentence of sentences) {
        let chunk = "";

        for (const word of sentence.trim().split(/\s+/)) {
          if (chunk && `${chunk} ${word}`.length > 180) {
            output.push(chunk);
            chunk = "";
          }

          chunk = chunk ? `${chunk} ${word}` : word;
        }

        if (chunk) output.push(chunk);
      }

      return output;
    }

    function speakChunk(text, voice, lang, run) {
      return new Promise((resolve, reject) => {
        if (run !== speechRun) {
          resolve(false);
          return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        const config = speechSettings[lang];
        let settled = false;

        utterance.voice = voice;
        utterance.lang = voice.lang || config.locale;
        utterance.rate = config.rate;
        utterance.pitch = config.pitch;
        utterance.volume = config.volume;

        function finish(error, completed = true) {
          if (settled) return;
          settled = true;

          clearTimeout(timer);
          utterance.onend = null;
          utterance.onerror = null;

          if (activeUtterance === utterance) activeUtterance = null;
          if (cancelSpeechWait === cancel) cancelSpeechWait = null;

          if (error) reject(error);
          else resolve(completed);
        }

        function cancel() {
          finish(null, false);
        }

        const timer = setTimeout(() => {
          if (run !== speechRun) {
            finish(null, false);
            return;
          }

          finish(new Error("Speech timed out."));
          window.speechSynthesis.cancel();
        }, 60000);

        utterance.onend = () => finish(null, true);

        utterance.onerror = event => {
          if (
            run !== speechRun ||
            event.error === "canceled" ||
            event.error === "interrupted"
          ) {
            finish(null, false);
          } else {
            finish(new Error(event.error || "Speech failed."));
          }
        };

        activeUtterance = utterance;
        cancelSpeechWait = cancel;

        try {
          window.speechSynthesis.speak(utterance);
        } catch (error) {
          finish(error);
        }
      });
    }

    async function readAloud(lang) {
      const sameLanguage = readingLanguage === lang;

      stopReading();
      if (sameLanguage) return;

      stopRecognition();

      if (
        !("speechSynthesis" in window) ||
        !("SpeechSynthesisUtterance" in window)
      ) {
        status(
          "ይህ አሳሽ የድምፅ ንባብን አይደግፍም።",
          "Reading aloud is unavailable in this browser.",
          "warn"
        );
        return;
      }

      const text = readingText(lang).trim();

      if (!text) {
        status(
          "በተመረጠው ቋንቋ የመልስ ጽሑፍ የለም።",
          "There is no answer text in that language.",
          "warn"
        );
        return;
      }

      const run = speechRun;
      readingLanguage = lang;
      updateMediaButtons();

      try {
        const voices = await loadVoices(run);
        if (run !== speechRun) return;

        const voice = chooseVoice(voices, lang);

        if (!voice) {
          status(
            "በዚህ መሣሪያ ለተመረጠው ቋንቋ የንባብ ድምፅ አልተገኘም።",
            `No ${lang === "am" ? "Amharic" : "English"} reading voice is available on this device.`,
            "warn"
          );
          return;
        }

        for (const chunk of speechChunks(text)) {
          if (run !== speechRun) return;

          const completed = await speakChunk(chunk, voice, lang, run);

          if (!completed || run !== speechRun) return;
        }
      } catch (error) {
        if (run === speechRun) {
          status(
            "የድምፅ ንባቡ አልተሳካም።",
            "Reading could not finish. Please try again.",
            "warn"
          );

          console.warn("Speech failed:", error.message);
        }
      } finally {
        if (run === speechRun) {
          readingLanguage = null;
          updateMediaButtons();
        }
      }
    }

    on("speakAmharicBtn", () => readAloud("am"));
    on("speakEnglishBtn", () => readAloud("en"));

    /* ======================================================
       MICROPHONE — SOFT START / END TONES
       ====================================================== */

    let audioContext = null;
    let recognitionSession = null;

    function unlockAudio() {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) return;

      try {
        audioContext ||= new AudioContextClass();
        audioContext.resume().catch(() => {});
      } catch {
        // Beeps are optional.
      }
    }

    function beep(start) {
      if (!audioContext || audioContext.state !== "running") return;

      try {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const time = audioContext.currentTime;

        osc.type = "sine";
        osc.frequency.setValueAtTime(start ? 620 : 820, time);
        osc.frequency.exponentialRampToValueAtTime(
          start ? 820 : 580,
          time + 0.16
        );

        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(0.045, time + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);

        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };

        osc.start(time);
        osc.stop(time + 0.2);
      } catch {
        // Do not interrupt recording when audio is unavailable.
      }
    }

    function finishRecognition(session) {
      if (!session || session.finished) return;
      session.finished = true;

      if (session.started) beep(false);

      if (recognitionSession === session) {
        recognitionSession = null;
      }

      updateMediaButtons();
    }

    function stopRecognition() {
      const session = recognitionSession;
      if (!session) return;

      recognitionSession = null;
      session.recognizer.onresult = null;

      try {
        session.recognizer.abort();
      } catch {
        // Already stopped.
      }

      finishRecognition(session);
    }

    function startRecognition(lang) {
      const previousLang = recognitionSession?.lang;

      stopRecognition();
      if (previousLang === lang) return;

      stopReading();
      unlockAudio();

      const Recognizer =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!Recognizer) {
        status(
          "የድምፅ ግብዓት አይገኝም። እባክዎ ጥያቄዎን ይጻፉ።",
          "Voice input is unavailable. Please type your question.",
          "warn"
        );
        return;
      }

      const recognizer = new Recognizer();

      const session = {
        recognizer,
        lang,
        started: false,
        finished: false,
        received: false,
        failed: false
      };

      recognitionSession = session;

      recognizer.lang = lang === "am" ? "am-ET" : "en-US";
      recognizer.continuous = false;
      recognizer.interimResults = false;

      recognizer.onstart = () => {
        if (recognitionSession !== session) {
          try { recognizer.abort(); } catch {}
          return;
        }

        session.started = true;
        beep(true);
        updateMediaButtons();

        status("እባክዎ ይናገሩ።", "Listening. Please speak.");
      };

      recognizer.onresult = event => {
        if (recognitionSession !== session) return;

        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join(" ")
          .trim();

        if (!transcript) return;

        session.received = true;

        el.question.value = [
          el.question.value.trim(),
          transcript
        ].filter(Boolean).join(" ");

        status(
          "ጥያቄዎ ተጽፏል። መልስ አግኝ ይጫኑ።",
          "Your words were added. Press Get Answer.",
          "ok"
        );
      };

      recognizer.onerror = event => {
        if (recognitionSession !== session) return;
        session.failed = true;

        if (event.error !== "aborted") {
          status(
            "የድምፅ ግብዓት አልተሳካም። ፈቃድና ግንኙነትዎን ያረጋግጡ።",
            `Voice input failed: ${event.error}. Check microphone permission and connection.`,
            "warn"
          );
        }
      };

      recognizer.onend = () => {
        const wasCurrent = recognitionSession === session;
        finishRecognition(session);

        if (wasCurrent && !session.received && !session.failed) {
          status(
            "ንግግር አልተገኘም። እንደገና ይሞክሩ።",
            "No speech was captured. Please try again.",
            "warn"
          );
        }
      };

      updateMediaButtons();

      try {
        recognizer.start();
      } catch {
        finishRecognition(session);

        status(
          "ማይክሮፎኑን መጀመር አልተቻለም።",
          "The microphone could not start.",
          "warn"
        );
      }
    }

    on("voiceAmharicBtn", () => startRecognition("am"));
    on("voiceEnglishBtn", () => startRecognition("en"));

    /* ======================================================
       CLEAR / COPY
       ====================================================== */

    function clearAll() {
      answerVersion++;
      answerController?.abort();
      answerController = null;

      // Clear first, independently of speech support.
      el.question.value = "";
      el.answer.value = "";

      el.question.scrollTop = 0;
      el.answer.scrollTop = 0;
      el.answer.style.removeProperty("height");

      currentAnswer = null;
      copiedQuestion = "";

      stopReading();
      stopRecognition();
      setBusy(el.getAnswerBtn, false);

      status("ጽሑፉ ተጽድቷል።", "Question and answer cleared.");
      el.question.focus({ preventScroll: true });
    }

    on("clearBtn", clearAll);

    async function copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    }

    on("copyBtn", async () => {
      const question = el.question.value.trim();

      if (!question) {
        status(
          "እባክዎ መጀመሪያ ጥያቄ ይጻፉ።",
          "Please type a question first.",
          "warn"
        );
        return;
      }

      copiedQuestion = question;
      const copied = await copyText(question);

      status(
        copied
          ? "ጥያቄው ተቀድቷል።"
          : "ጥያቄው ለእርዳታ ተዘጋጅቷል፤ ወደ ቅንጭብ ሰሌዳ ግን አልተቀዳም።",
        copied
          ? "Question copied."
          : "Question saved for Help, but clipboard access was unavailable.",
        copied ? "ok" : "warn"
      );
    });

    /* ======================================================
       TELEGRAM HANDOFF
       Opens synchronously during the user's click.
       Keeps a visible recovery message and copy button.
       ====================================================== */

    function telegramHandoff(message, container) {
      const url = new URL(TELEGRAM_URL);
      url.searchParams.set("text", message);

      let popup = null;

      try {
        popup = window.open("about:blank", "_blank");

        if (popup) {
          popup.opener = null;
          popup.location.replace(url.href);
        }
      } catch {
        try { popup?.close(); } catch {}
        popup = null;
      }

      container?.querySelector(".telegram-handoff")?.remove();

      const panel = document.createElement("div");
      panel.className = "telegram-handoff privacy-note";

      const note = document.createElement("p");
      note.textContent = language === "am"
        ? "Telegram ውስጥ ጽሑፉ ካልታየ፣ ከታች ቅዳ ይጫኑ፣ ከዚያ ለጥፈው ይላኩ።"
        : "If Telegram does not show the draft, copy the message below, paste it into the bot, and press Send.";

      const draft = document.createElement("textarea");
      draft.readOnly = true;
      draft.value = message;
      draft.rows = 4;
      draft.setAttribute("aria-label", "Telegram request message");

      const copy = document.createElement("button");
      copy.type = "button";
      copy.textContent = language === "am"
        ? "መልዕክቱን ቅዳ"
        : "Copy message";

      copy.addEventListener("click", async () => {
        if (await copyText(message)) {
          copy.textContent = language === "am" ? "ተቀድቷል" : "Copied";
        } else {
          draft.focus({ preventScroll: true });
          draft.select();
          copy.textContent = "Select and copy the message";
        }
      });

      const link = document.createElement("a");
      link.className = "course-link";
      link.href = url.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = language === "am"
        ? "Telegram ክፈት"
        : "Open Telegram";

      panel.append(note, draft, copy, document.createTextNode(" "), link);

      container?.append(panel);

      return Boolean(popup);
    }

    on("helpBtn", () => {
      stopReading();
      stopRecognition();

      const question = el.question.value.trim() || copiedQuestion;

      const message = question
        ? `Learning support request\n\nQuestion:\n${question}`
        : "Hello, I need learning support.";

      telegramHandoff(message, el.helpBtn.closest(".answer-box"));

      status(
        "የTelegram ጥያቄዎ ተዘጋጅቷል። ጽሑፉን ያረጋግጡና Send ይጫኑ።",
        "Telegram handoff prepared. Check the draft and press Send."
      );
    });

    /* ======================================================
       FORMS — EXPLICITLY CLEAR FIELDS
       ====================================================== */

    function clearForm(form) {
      form.reset();

      form.querySelectorAll("input, textarea, select").forEach(field => {
        if (field instanceof HTMLSelectElement) {
          field.selectedIndex = 0;
        } else if (field.type === "checkbox" || field.type === "radio") {
          field.checked = false;
        } else if (!["submit", "button", "hidden"].includes(field.type)) {
          field.value = "";
        }
      });
    }

    function value(id) {
      return $(id)?.value.trim() || "";
    }

    function validPhone(phone) {
      return !phone || /^[+\d\s()-]{7,25}$/.test(phone);
    }

    async function submitFormRequest({
      form,
      button,
      endpoint,
      payload,
      message,
      target
    }) {
      if (form.dataset.busy === "true") return;

      form.dataset.busy = "true";
      setBusy(button, true);

      const opened = telegramHandoff(message, form.parentElement);

      // Clear immediately only when the new window was opened.
      // Otherwise keep the inputs until server success.
      if (opened) clearForm(form);

      status(
        "ጥያቄውን በአገልጋዩ ላይ እያስቀመጥን ነው...",
        "Saving your request to the server...",
        "info",
        target
      );

      try {
        await request(endpoint, {
          method: "POST",
          body: payload
        });

        clearForm(form);

        status(
          "ጥያቄዎ በአገልጋዩ ላይ ተቀምጧል። በTelegram ያለውን መልዕክት ከመላክዎ በፊት ያረጋግጡ።",
          "The server accepted your request. Review the Telegram message before sending it.",
          "ok",
          target
        );
      } catch {
        status(
          "በአገልጋዩ ላይ መቀመጡ አልተረጋገጠም። ከታች ያለውን መልዕክት በTelegram ይላኩ።",
          "Server submission was not confirmed. Use the message below to send the request in Telegram.",
          "warn",
          target
        );
      } finally {
        delete form.dataset.busy;
        setBusy(button, false);
      }
    }

    el.jobAlertForm?.addEventListener("submit", event => {
      event.preventDefault();

      const phone = value("jobPhone");
      const telegram = value("jobTelegram");
      const area = value("jobArea");

      if ((!phone && !telegram) || !area || !validPhone(phone)) {
        status(
          "የስልክ ቁጥር ወይም Telegram ስም ያስገቡ፣ የሥራ መስክም ይምረጡ።",
          "Enter a valid phone number or Telegram username and select a job area.",
          "warn",
          jobStatus
        );
        return;
      }

      submitFormRequest({
        form: el.jobAlertForm,
        button: el.jobAlertBtn,
        endpoint: "/api/job-alert",
        target: jobStatus,
        payload: {
          chatId,
          phone,
          telegram,
          area,
          notify: true,
          source: "web"
        },
        message: [
          "Job alert request",
          `Phone: ${phone || "Not provided"}`,
          `Telegram: ${telegram || "Not provided"}`,
          `Job area: ${area}`
        ].join("\n")
      });
    });

    el.accommodationForm?.addEventListener("submit", event => {
      event.preventDefault();

      const name = value("accommodationName");
      const phone = value("accommodationPhone");
      const type = value("accommodationType");
      const details = value("accommodationDetails");

      if (!name || !phone || !type || !validPhone(phone)) {
        status(
          "ስምዎን፣ ትክክለኛ ስልክ ቁጥርና የድጋፍ ዓይነት ያስገቡ።",
          "Enter your name, a valid phone number, and support type.",
          "warn",
          accommodationStatus
        );
        return;
      }

      submitFormRequest({
        form: el.accommodationForm,
        button: el.accommodationBtn,
        endpoint: "/api/accommodation",
        target: accommodationStatus,
        payload: {
          chatId,
          name,
          phone,
          type,
          details,
          status: "requested",
          source: "web"
        },
        message: [
          "Interview support request",
          `Name: ${name}`,
          `Phone: ${phone}`,
          `Support: ${type}`,
          `Details: ${details || "Not provided"}`
        ].join("\n")
      });
    });

    /* ======================================================
       MEETING LINK / DOWNLOAD
       ====================================================== */

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
          "Please enter a valid HTTPS meeting link.",
          "warn"
        );
        return;
      }

      if (!window.confirm(`Send this meeting link to support?\n${meetingLink}`)) {
        return;
      }

      telegramHandoff(
        `Meeting support request\n\n${meetingLink}`,
        el.screenShareBtn.closest(".answer-box")
      );

      request("/api/screen-share", {
        method: "POST",
        body: { chatId, meetingLink, source: "web" }
      }).then(() => {
        status(
          "የስብሰባ ሊንኩ በአገልጋዩ ላይ ተቀምጧል።",
          "The server accepted your meeting-link request.",
          "ok"
        );
      }).catch(() => {
        status(
          "በአገልጋዩ ላይ መቀመጡ አልተረጋገጠም። Telegram ይጠቀሙ።",
          "Server submission was not confirmed. Use Telegram.",
          "warn"
        );
      });
    });

    on("downloadBtn", () => {
      const content = [
        "Learning and Employment / ትምህርት እና ሥራ",
        `Question:\n${el.question.value}`,
        `Answer:\n${el.answer.value}`
      ].join("\n\n");

      const blob = new Blob(["\uFEFF", content], {
        type: "text/plain;charset=utf-8"
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "learning-and-employment.txt";

      document.body.append(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });

    /* ======================================================
       TEACHER STATISTICS — SAFE TEXT RENDERING
       ====================================================== */

    async function loadTeacherStats() {
      if (!el.teacherStats) return;

      try {
        const data = await request("/api/teacher-stats");
        const questions = Array.isArray(data.questions)
          ? data.questions.slice(0, 30)
          : [];

        el.teacherStats.replaceChildren();

        if (!questions.length) {
          el.teacherStats.textContent = "No questions available yet.";
          return;
        }

        const list = document.createElement("ol");

        questions.forEach(item => {
          const row = document.createElement("li");
          row.textContent =
            `${String(item.question || "")} — ${Number(item.count) || 0}`;

          list.append(row);
        });

        el.teacherStats.append(list);
      } catch {
        el.teacherStats.textContent =
          "Teacher statistics are unavailable or require authorization.";
      }
    }

    /* ======================================================
       NON-DESTRUCTIVE DIAGNOSTICS
       Does not claim SMS / Telegram delivery was tested.
       ====================================================== */

    async function testWebsite() {
      const results = [];

      function add(test, passed, details = "") {
        results.push({ test, passed, details });
      }

      ids.forEach(id => {
        const count = document.querySelectorAll(`[id="${id}"]`).length;
        add(`Unique #${id}`, count === 1, `Found ${count}`);
      });

      add(
        "English local FAQ",
        Boolean(localAnswer("What is downloading?"))
      );

      add(
        "Amharic local FAQ",
        Boolean(localAnswer("ማውረድ ምን ማለት ነው?"))
      );

      add("Arithmetic", solveMath("25 * 4") === 100);
      add("Reading API", "speechSynthesis" in window);

      if ("speechSynthesis" in window) {
        const voices = window.speechSynthesis.getVoices();

        add(
          "English voice currently loaded",
          Boolean(chooseVoice(voices, "en"))
        );

        add(
          "Amharic voice currently loaded",
          Boolean(chooseVoice(voices, "am"))
        );
      }

      try {
        await request("/health", { timeout: 8000 });
        add("Server health", true);
      } catch {
        add("Server health", false, "Check network, CORS and /health.");
      }

      console.table(results);

      status(
        "የሙከራ ውጤቶች በConsole ውስጥ አሉ።",
        "Diagnostic results are in the console. Delivery and accessibility still need manual testing."
      );

      return results;
    }

    window.testWebsite = testWebsite;

    /* ======================================================
       START / CLEANUP
       ====================================================== */

    document.body.classList.toggle(
      "high-contrast",
      settings.highContrast === true
    );

    el.contrastBtn?.setAttribute(
      "aria-pressed",
      String(settings.highContrast === true)
    );

    applyFont();
    updateLanguage();
    loadTeacherStats();

    window.addEventListener("pagehide", () => {
      answerVersion++;
      answerController?.abort();
      stopReading();
      stopRecognition();
    });

    console.info(
      "Learning app initialized once. Run testWebsite() for diagnostics."
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();