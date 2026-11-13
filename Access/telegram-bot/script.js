"use strict";

(() => {
  /* =========================================================
     LEARNING AND EMPLOYMENT — TRACK 3 POWERFUL SCRIPT.JS
     Railway bot + Telegram teacher/admin + course answers
     ========================================================= */

  const TELEGRAM_BOT_URL = "https://t.me/EbaMengistBot";

  // Your existing Railway API
  const API_BASE_URL =
    "https://learning-assistant-bot-production.up.railway.app";

  const $ = id => document.getElementById(id);

  const questionInput = $("question");
  const answerBox = $("answer");
  const getAnswerBtn = $("getAnswerBtn");
  const clearBtn = $("clearBtn");
  const copyBtn = $("copyBtn");
  const languageToggleBtn = $("languageToggleBtn");
  const speakAmharicBtn = $("speakAmharicBtn");
  const speakEnglishBtn = $("speakEnglishBtn");
  const voiceAmharicBtn = $("voiceAmharicBtn");
  const voiceEnglishBtn = $("voiceEnglishBtn");
  const contrastBtn = $("contrastBtn");
  const fontSmall = $("fontSmall");
  const fontNormal = $("fontNormal");
  const fontLarge = $("fontLarge");
  const helpBtn = $("helpBtn");
  const screenShareBtn = $("screenShareBtn");
  const downloadBtn = $("downloadBtn");
  const jobAlertForm = $("jobAlertForm");
  const accommodationForm = $("accommodationForm");
  const teacherStats = $("teacherStats");
  const liveRegion = $("liveRegion");
  const voiceStatus = $("voiceStatus");

  const ETHIOPIC = /[\u1200-\u137F]/;
  const CACHE_KEY = "learningAnswers_v7";
  const SETTINGS_KEY = "learningSettings_v7";
  const CHAT_ID_KEY = "learningChatId_v7";

  let language = "am";
  let fontSize = 1.05;
  let requestVersion = 0;
  let recognition = null;
  let recognitionButton = null;
  let speakingLanguage = null;
  let speechVersion = 0;
  let cancelAudio = null;

  const audio = new Audio();
  const flashTimers = new WeakMap();

  /* =========================================================
     OFFLINE COURSE FAQ
     Add approved course answers here.
     ========================================================= */

  const courseFAQ = {
    "what is downloading": {
      en: "Downloading means saving a file from the internet to your device.",
      am: "ማውረድ ማለት ፋይልን ከኢንተርኔት ወደ መሣሪያዎ ማስቀመጥ ማለት ነው።",
      source: "Computer Basics — Page 12"
    },

    "what is email": {
      en: "Email is a way to send and receive messages using the internet.",
      am: "ኢሜይል በኢንተርኔት መልዕክት ለመላክ እና ለመቀበል የሚያግዝ መንገድ ነው።",
      source: "Internet and Email — Page 5"
    },

    "what is a job interview": {
      en: "A job interview is a meeting where an employer asks you questions about your skills and experience.",
      am: "የሥራ ቃለ መጠይቅ አስተዋዋቂ ስለ ክህሎትዎና ልምድዎ ጥያቄ የሚጠይቅበት ስብሰባ ነው።",
      source: "Jobs and Interviews — Page 3"
    },

    "how do i apply for a job": {
      en: "Read the job advertisement, prepare your CV, write a short cover letter if needed, and submit your application before the deadline.",
      am: "የሥራ ማስታወቂያውን ያንብቡ፣ CVዎን ያዘጋጁ፣ አስፈላጊ ከሆነ አጭር የምልጠኛ ደብዳቤ ይጻፉ እና መደበኛውን ጊዜ ሳይበቃ ያስገቡ።",
      source: "Jobs and Interviews — Page 7"
    }
  };

  /* =========================================================
     LANGUAGE TEXT
     ========================================================= */

  const labels = {
    am: {
      question: "ጥያቄዎን ይጻፉ",
      answer: "መልስ",
      questionPlaceholder: "ለምሳሌ፦ ማውረድ ምን ማለት ነው?",
      answerPlaceholder: "መልሱ እዚህ ይታያል...",
      getAnswer: "🤖 መልስ አግኝ",
      clear: "🧹 አጽዳ",
      copy: "📋 ቅዳ",
      micAm: "🎤 አማርኛ",
      micEn: "🎤 English",
      speakAm: "🔊 አማርኛ",
      speakEn: "🔊 English",
      help: "🙋 እርዳታ አስፈልገኛል",
      screen: "🖥️ ስክሪን ማጋራት",
      download: "⬇️ አውርድ",
      listening: "⏹ እያዳመጥኩ ነው...",
      stop: "⏹ አቁም"
    },

    en: {
      question: "Ask your question",
      answer: "Answer",
      questionPlaceholder: "Example: What is downloading?",
      answerPlaceholder: "Your answer will appear here...",
      getAnswer: "🤖 Get Answer",
      clear: "🧹 Clear",
      copy: "📋 Copy",
      micAm: "🎤 Amharic",
      micEn: "🎤 English",
      speakAm: "🔊 Amharic",
      speakEn: "🔊 English",
      help: "🙋 I Need Help",
      screen: "🖥️ Share My Screen",
      download: "⬇️ Download",
      listening: "⏹ Listening...",
      stop: "⏹ Stop"
    }
  };

  /* =========================================================
     SETTINGS
     ========================================================= */

  function readSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveSetting(key, value) {
    const settings = readSettings();
    settings[key] = value;

    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Storage may be unavailable.
    }
  }

  function getChatId() {
    let chatId = readSettings().chatId;

    if (!chatId) {
      chatId = `web-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}`;

      saveSetting("chatId", chatId);
    }

    return chatId;
  }

  /* =========================================================
     HELPERS
     ========================================================= */

  function announce(text) {
    if (liveRegion) liveRegion.textContent = text;
  }

  function status(amharic, english, type = "info") {
    const text = language === "am" ? amharic : english;

    if (voiceStatus) {
      voiceStatus.textContent = text;
      voiceStatus.className = `voice-status ${type}`;
    }

    announce(text);
  }

  function resizeAnswer() {
    if (!answerBox) return;

    answerBox.style.height = "auto";
    answerBox.style.height =
      Math.max(210, answerBox.scrollHeight + 8) + "px";
  }

  function showAnswer(text) {
    answerBox.value = String(text);
    resizeAnswer();
    announce(text);
  }

  function bilingual(english, amharic) {
    return `${english}\n\n${amharic}`;
  }

  function on(button, handler) {
    button?.addEventListener("click", handler);
  }

  function flashButton(button) {
    if (!button) return;

    clearTimeout(flashTimers.get(button));

    button.classList.remove("button-flash");
    void button.offsetWidth;
    button.classList.add("button-flash");

    flashTimers.set(
      button,
      setTimeout(() => button.classList.remove("button-flash"), 600)
    );
  }

  function selectButton(button) {
    document.querySelectorAll("button").forEach(item => {
      item.classList.remove("active-primary", "active");
    });

    if (button !== getAnswerBtn) {
      button.classList.add("active-primary");
    }
  }

  document.querySelectorAll("button").forEach(button => {
    button.classList.remove("active-primary", "active");

    on(button, () => {
      selectButton(button);
      flashButton(button);
    });
  });

  function setText(element, text) {
    if (element) element.textContent = text;
  }

  /* =========================================================
     LANGUAGE SWITCH
     ========================================================= */

  function applyLanguage() {
    const t = labels[language];

    document.documentElement.lang = language;

    setText(document.querySelector('label[for="question"]'), t.question);
    setText(document.querySelector('label[for="answer"]'), t.answer);

    questionInput.placeholder = t.questionPlaceholder;
    answerBox.placeholder = t.answerPlaceholder;

    setText(getAnswerBtn, t.getAnswer);
    setText(clearBtn, t.clear);
    setText(copyBtn, t.copy);
    setText(helpBtn, t.help);
    setText(screenShareBtn, t.screen);
    setText(downloadBtn, t.download);

    setText(
      voiceAmharicBtn,
      recognitionButton === voiceAmharicBtn ? t.listening : t.micAm
    );

    setText(
      voiceEnglishBtn,
      recognitionButton === voiceEnglishBtn ? t.listening : t.micEn
    );

    setText(
      speakAmharicBtn,
      speakingLanguage === "am" ? t.stop : t.speakAm
    );

    setText(
      speakEnglishBtn,
      speakingLanguage === "en" ? t.stop : t.speakEn
    );

    saveSetting("language", language);
    updateConnectionBadge();
  }

  on(languageToggleBtn, () => {
    language = language === "am" ? "en" : "am";
    applyLanguage();

    languageToggleBtn.classList.remove("language-flash");
    void languageToggleBtn.offsetWidth;
    languageToggleBtn.classList.add("language-flash");

    setTimeout(
      () => languageToggleBtn.classList.remove("language-flash"),
      2000
    );

    status(
      "አማርኛ ተመርጧል።",
      "English selected."
    );
  });

  /* =========================================================
     FONT SIZE AND CONTRAST
     ========================================================= */

  function changeFontSize(change = 0, reset = false) {
    fontSize = reset
      ? 1.05
      : Math.max(0.9, Math.min(1.8, fontSize + change));

    questionInput.style.fontSize = `${fontSize}rem`;
    answerBox.style.fontSize = `${fontSize}rem`;

    saveSetting("fontSize", fontSize);
    resizeAnswer();
  }

  on(fontSmall, () => changeFontSize(-0.08));
  on(fontNormal, () => changeFontSize(0, true));
  on(fontLarge, () => changeFontSize(0.08));

  function updateConnectionBadge() {
    let badge = $("netBadge");

    if (!badge) {
      badge = document.createElement("p");
      badge.id = "netBadge";
      badge.setAttribute("role", "status");
      badge.style.textAlign = "center";
      $("main")?.prepend(badge);
    }

    const online = navigator.onLine !== false;

    badge.textContent = language === "am"
      ? online
        ? "🟢 ኢንተርኔት አለ"
        : "🔴 ኢንተርኔት የለም"
      : online
        ? "🟢 Online"
        : "🔴 Offline";

    badge.style.color = document.body.classList.contains("high-contrast")
      ? "#ffd166"
      : online ? "#166534" : "#b91c1c";
  }

  window.addEventListener("online", updateConnectionBadge);
  window.addEventListener("offline", updateConnectionBadge);

  function updateContrastButton() {
    contrastBtn?.setAttribute(
      "aria-pressed",
      String(document.body.classList.contains("high-contrast"))
    );
  }

  on(contrastBtn, () => {
    document.body.classList.toggle("high-contrast");
    updateContrastButton();
    updateConnectionBadge();
  });

  /* =========================================================
     OFFLINE CACHE
     ========================================================= */

  function readCache() {
    try {
      const data = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
      return data && typeof data === "object" ? data : {};
    } catch {
      return {};
    }
  }

  function cacheAnswer(key, value) {
    const cache = readCache();
    cache[key] = value;

    const keys = Object.keys(cache);

    while (keys.length > 100) {
      delete cache[keys.shift()];
    }

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
      // Storage may be unavailable.
    }
  }

  /* =========================================================
     RAILWAY API
     ========================================================= */

  async function apiRequest(endpoint, data, timeout = 20000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`API error: HTTP ${response.status}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function apiGet(endpoint, timeout = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`API error: HTTP ${response.status}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /* =========================================================
     TRANSLATION
     ========================================================= */

  function splitText(text, limit = 180) {
    const words = String(text).trim().split(/\s+/);
    const chunks = [];
    let chunk = "";

    for (let word of words) {
      if (chunk && `${chunk} ${word}`.length > limit) {
        chunks.push(chunk);
        chunk = "";
      }

      while (word.length > limit) {
        chunks.push(word.slice(0, limit));
        word = word.slice(limit);
      }

      if (word) {
        chunk = chunk ? `${chunk} ${word}` : word;
      }
    }

    if (chunk) chunks.push(chunk);
    return chunks;
  }

  async function translateText(text, from, to) {
    const output = [];

    for (const chunk of splitText(text, 400)) {
      const url =
        "https://translate.googleapis.com/translate_a/single" +
        "?client=gtx&dt=t" +
        `&sl=${from}&tl=${to}&q=${encodeURIComponent(chunk)}`;

      const response = await fetch(url);
      const data = await response.json();

      const translated = data[0]
        .map(part => part[0] || "")
        .join("");

      if (!translated.trim()) {
        throw new Error("Translation unavailable");
      }

      output.push(translated);
    }

    return output.join(" ");
  }

  /* =========================================================
     MATH
     ========================================================= */

  function solveMath(question) {
    const expression = question.toLowerCase()
      .replace(/^(what is|calculate|solve)\s+/i, "")
      .replace(/\?$/g, "")
      .replace(/\bmultiplied by\b|\btimes\b|ሲባዛ/g, "*")
      .replace(/\bdivided by\b|ሲካፈል/g, "/")
      .replace(/\bplus\b|ሲደመር/g, "+")
      .replace(/\bminus\b|ሲቀነስ/g, "-")
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .trim();

    if (!/^[\d\s.+*/()-]+$/.test(expression)) return null;
    if (!/[+*/-]/.test(expression)) return null;

    const tokens = expression.match(/\d*\.?\d+|[()+*/-]/g) || [];
    let index = 0;

    function factor() {
      const token = tokens[index++];

      if (token === "+") return factor();
      if (token === "-") return -factor();

      if (token === "(") {
        const value = sum();

        if (tokens[index++] !== ")") {
          throw new Error("Missing bracket");
        }

        return value;
      }

      if (!token || !/^\d*\.?\d+$/.test(token)) {
        throw new Error("Invalid number");
      }

      return Number(token);
    }

    function product() {
      let value = factor();

      while (["*", "/"].includes(tokens[index])) {
        const operator = tokens[index++];
        const right = factor();

        value = operator === "*"
          ? value * right
          : value / right;
      }

      return value;
    }

    function sum() {
      let value = product();

      while (["+", "-"].includes(tokens[index])) {
        const operator = tokens[index++];
        const right = product();

        value = operator === "+"
          ? value + right
          : value - right;
      }

      return value;
    }

    try {
      const value = sum();

      return index === tokens.length && Number.isFinite(value)
        ? Number(value.toPrecision(12))
        : null;
    } catch {
      return null;
    }
  }

  /* =========================================================
     COURSE ANSWERS
     ========================================================= */

  function findCourseAnswer(question) {
    const q = question.toLowerCase().trim();

    for (const [key, answer] of Object.entries(courseFAQ)) {
      if (q.includes(key)) {
        return bilingual(answer.en, answer.am) +
          `\n\n📚 Source / ምንጭ: ${answer.source}`;
      }
    }

    const math = solveMath(q);

    if (math !== null) {
      return bilingual(
        `The answer is ${math}.`,
        `መልሱ ${math} ነው።`
      ) + "\n\n📚 Source / ምንጭ: Built-in course calculator";
    }

    return null;
  }

  async function getRailwayAnswer(question) {
    const data = await apiRequest("/api/ask", {
      chatId: getChatId(),
      question,
      language
    });

    const answer =
      data.answer ||
      data.response ||
      data.text;

    if (!answer) {
      throw new Error("No answer returned by Railway API");
    }

    const source = data.source || data.citation;

    return source
      ? `${answer}\n\n📚 Source / ምንጭ: ${source}`
      : answer;
  }

  async function getWebAnswer(question) {
    const englishQuestion = ETHIOPIC.test(question)
      ? await translateText(question, "am", "en")
      : question;

    const query = englishQuestion
      .replace(
        /^(what is|what are|who is|explain|define|tell me about)\s+/i,
        ""
      )
      .replace(/[?]/g, "")
      .trim();

    const searchUrl =
      "https://en.wikipedia.org/w/api.php" +
      "?action=query&list=search&format=json&origin=*&srlimit=1" +
      `&srsearch=${encodeURIComponent(query)}`;

    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    const hit = searchData.query?.search?.[0];

    if (!hit) {
      throw new Error("No matching information");
    }

    const pageUrl =
      "https://en.wikipedia.org/w/api.php" +
      "?action=query&prop=extracts&explaintext=1&exintro=1" +
      "&format=json&origin=*&redirects=1" +
      `&titles=${encodeURIComponent(hit.title)}`;

    const pageResponse = await fetch(pageUrl);
    const pageData = await pageResponse.json();

    const page = Object.values(pageData.query?.pages || {})[0];
    const extract = page?.extract?.trim();

    if (!extract) {
      throw new Error("No article text");
    }

    const sentences = extract.match(/[^.!?]+[.!?]+(?:\s|$)/g);
    const english = (
      sentences ? sentences.slice(0, 2).join("") : extract
    ).trim().slice(0, 900);

    let amharic;

    try {
      amharic = await translateText(english, "en", "am");
    } catch {
      amharic = "የአማርኛ ትርጉም አሁን አልተገኘም።";
    }

    const source =
      "https://en.wikipedia.org/wiki/" +
      encodeURIComponent(hit.title.replace(/ /g, "_"));

    return bilingual(english, amharic) +
      `\n\n📚 Source / ምንጭ: ${hit.title}\n${source}`;
  }

  async function getAnswer() {
    const question = questionInput.value.trim();
    const version = ++requestVersion;

    stopAllSpeech();
    stopRecognition();

    if (!question) {
      showAnswer(bilingual(
        "Please type a course question.",
        "እባክዎ የትምህርት ጥያቄ ይጻፉ።"
      ));

      questionInput.focus();
      return;
    }

    const cacheKey = question.toLowerCase();
    const cached = readCache()[cacheKey];
    const local = findCourseAnswer(question);

    if (local) {
      showAnswer(local);
      return;
    }

    if (typeof cached === "string") {
      showAnswer(cached);
      return;
    }

    if (navigator.onLine === false) {
      showAnswer(bilingual(
        "This question needs internet. Basic course answers still work offline.",
        "ይህ ጥያቄ ኢንተርኔት ያስፈልገዋል። መሠረታዊ የትምህርት መልሶች ያለ ኢንተርኔት ይሰራሉ።"
      ));

      return;
    }

    showAnswer("🔎 እየፈለግሁ ነው... / Searching...");

    getAnswerBtn.disabled = true;
    getAnswerBtn.setAttribute("aria-busy", "true");

    try {
      const railwayAnswer = await getRailwayAnswer(question);
      cacheAnswer(cacheKey, railwayAnswer);

      if (version === requestVersion) {
        showAnswer(railwayAnswer);
      }

      return;
    } catch (railwayError) {
      console.warn("Railway API failed:", railwayError);
    }

    try {
      const webAnswer = await getWebAnswer(question);
      cacheAnswer(cacheKey, webAnswer);

      if (version === requestVersion) {
        showAnswer(webAnswer);
      }
    } catch (webError) {
      console.warn("Web answer failed:", webError);

      if (version === requestVersion) {
        showAnswer(bilingual(
          "I could not find this in the course material. Press I Need Help to ask a teacher on Telegram.",
          "ይህን በትምህርት መረጃ ውስጥ ማግኘት አልቻልኩም። መምህር ለመጠየቅ እርዳታ አስፈልገኛል ይጫኑ።"
        ));
      }
    } finally {
      if (version === requestVersion) {
        getAnswerBtn.disabled = false;
        getAnswerBtn.removeAttribute("aria-busy");
      }
    }
  }

  on(getAnswerBtn, getAnswer);

  questionInput.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      getAnswerBtn?.click();
    }
  });

  /* =========================================================
     READ ALOUD
     ========================================================= */

  function stopAllSpeech() {
    speechVersion++;
    speakingLanguage = null;

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    cancelAudio?.();
    audio.pause();
    audio.removeAttribute("src");
    audio.load();

    speakAmharicBtn?.setAttribute("aria-pressed", "false");
    speakEnglishBtn?.setAttribute("aria-pressed", "false");
    applyLanguage();
  }

  function getVoices() {
    return new Promise(resolve => {
      if (!("speechSynthesis" in window)) {
        resolve([]);
        return;
      }

      const synth = window.speechSynthesis;

      if (synth.getVoices().length) {
        resolve(synth.getVoices());
        return;
      }

      function finish() {
        clearTimeout(timer);
        synth.removeEventListener("voiceschanged", finish);
        resolve(synth.getVoices());
      }

      const timer = setTimeout(finish, 1200);
      synth.addEventListener("voiceschanged", finish);
    });
  }

  function playAudio(url, version) {
    return new Promise((resolve, reject) => {
      let settled = false;

      function finish(error) {
        if (settled) return;

        settled = true;
        clearTimeout(timer);

        audio.onended = null;
        audio.onerror = null;
        cancelAudio = null;

        error ? reject(error) : resolve();
      }

      const timer = setTimeout(
        () => finish(new Error("Audio timeout")),
        60000
      );

      cancelAudio = () => finish(new Error("Cancelled"));
      audio.onended = () => finish();
      audio.onerror = () => finish(new Error("Audio unavailable"));

      if (version !== speechVersion) {
        finish(new Error("Cancelled"));
        return;
      }

      audio.src = url;
      audio.play().catch(finish);
    });
  }

  function extractLanguage(text, lang) {
    return text.split(/\n\s*📚/)[0]
      .split(/\n\s*\n/)
      .filter(part => lang === "am"
        ? ETHIOPIC.test(part)
        : /[A-Za-z]/.test(part) && !ETHIOPIC.test(part))
      .join("\n\n")
      .trim();
  }

  function speakDevice(text, voice, lang, version) {
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = lang === "am" ? "am-ET" : "en-US";
      utterance.rate = 0.92;

      const timer = setTimeout(() => {
        if (version === speechVersion) {
          window.speechSynthesis.cancel();
        }

        reject(new Error("Voice did not start"));
      }, 5000);

      utterance.onstart = () => clearTimeout(timer);

      utterance.onend = () => {
        clearTimeout(timer);
        resolve();
      };

      utterance.onerror = event => {
        clearTimeout(timer);
        reject(new Error(event.error));
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  async function readAloud(lang) {
    if (speakingLanguage === lang) {
      stopAllSpeech();
      return;
    }

    stopRecognition();
    stopAllSpeech();

    const text = extractLanguage(answerBox.value, lang);

    if (!text) {
      status(
        "ለማንበብ በዚህ ቋንቋ ጽሑፍ የለም።",
        "No text in this language is available to read.",
        "warn"
      );

      return;
    }

    const version = speechVersion;
    speakingLanguage = lang;

    const button = lang === "am" ? speakAmharicBtn : speakEnglishBtn;
    button?.setAttribute("aria-pressed", "true");
    applyLanguage();

    try {
      const voices = (await getVoices())
        .filter(voice => voice.lang.toLowerCase().startsWith(lang))
        .sort((a, b) =>
          Number(b.localService) - Number(a.localService)
        );

      if (version !== speechVersion) return;

      for (const voice of voices.slice(0, 3)) {
        try {
          await speakDevice(text, voice, lang, version);
          return;
        } catch {
          if (version !== speechVersion) return;
        }
      }

      if (navigator.onLine === false) {
        throw new Error("No offline voice");
      }

      for (const chunk of splitText(text)) {
        if (version !== speechVersion) return;

        const url =
          "https://translate.google.com/translate_tts" +
          "?ie=UTF-8&client=tw-ob" +
          `&tl=${lang}&q=${encodeURIComponent(chunk)}`;

        await playAudio(url, version);
      }
    } catch (error) {
      if (version === speechVersion) {
        console.warn("Read aloud failed:", error);

        status(
          "ድምፅ አሁን አልተገኘም። ጽሑፉን ማንበብ ይችላሉ።",
          "Voice is unavailable right now. The text remains on screen.",
          "warn"
        );
      }
    } finally {
      if (version === speechVersion) {
        speakingLanguage = null;
        button?.setAttribute("aria-pressed", "false");
        applyLanguage();
      }
    }
  }

  on(speakAmharicBtn, () => readAloud("am"));
  on(speakEnglishBtn, () => readAloud("en"));

  /* =========================================================
     VOICE INPUT
     ========================================================= */

  function stopRecognition() {
    const previous = recognition;
    recognition = null;
    recognitionButton = null;

    if (previous) {
      previous.onresult = null;

      try {
        previous.abort();
      } catch {
        // Recognition may already have ended.
      }
    }

    voiceAmharicBtn?.setAttribute("aria-pressed", "false");
    voiceEnglishBtn?.setAttribute("aria-pressed", "false");
    applyLanguage();
  }

  async function startVoice(lang, button) {
    if (recognition) {
      stopRecognition();
      return;
    }

    const Recognizer =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!Recognizer) {
      status(
        "ይህ አሳሽ የድምፅ ግብዓትን አይደግፍም። እባክዎ ይጻፉ።",
        "Voice input is unavailable in this browser. Please type.",
        "warn"
      );

      return;
    }

    stopAllSpeech();

    const current = new Recognizer();
    recognition = current;
    recognitionButton = button;

    current.lang = lang;
    current.continuous = false;
    current.interimResults = false;

    button?.setAttribute("aria-pressed", "true");
    applyLanguage();

    current.onresult = event => {
      if (recognition !== current) return;

      const text = event.results[0][0].transcript.trim();

      questionInput.value +=
        (questionInput.value && !/\s$/.test(questionInput.value) ? " " : "") +
        text;

      status(
        "ተመዝግቧል። መልስ አግኝ ይጫኑ።",
        "Got it. Press Get Answer.",
        "ok"
      );
    };

    current.onerror = event => {
      if (recognition !== current || event.error === "aborted") return;

      status(
        "የድምፅ ግብዓት አልተሳካም። የማይክሮፎን ፈቃድና ግንኙነትዎን ያረጋግጡ።",
        `Voice input failed (${event.error}). Check microphone permission and connection.`,
        "warn"
      );
    };

    current.onend = () => {
      if (recognition !== current) return;

      recognition = null;
      recognitionButton = null;
      button?.setAttribute("aria-pressed", "false");
      applyLanguage();
    };

    try {
      if (typeof Recognizer.available === "function") {
        try {
          const availability = await Recognizer.available({
            langs: [lang],
            processLocally: true
          });

          if (recognition !== current) return;
          if (availability === "available") current.processLocally = true;
        } catch {
          // Use default browser recognition.
        }
      }

      if (recognition !== current) return;
      current.start();

      status(
        "እባክዎ ይናገሩ...",
        "Please speak..."
      );
    } catch (error) {
      console.warn("Microphone failed:", error);
      stopRecognition();

      status(
        "ማይክሮፎኑን መጀመር አልተቻለም።",
        "Could not start the microphone.",
        "warn"
      );
    }
  }

  on(voiceAmharicBtn, () => startVoice("am-ET", voiceAmharicBtn));
  on(voiceEnglishBtn, () => startVoice("en-US", voiceEnglishBtn));

  /* =========================================================
     CLEAR AND COPY
     ========================================================= */

  on(clearBtn, () => {
    requestVersion++;
    stopRecognition();
    stopAllSpeech();

    questionInput.value = "";
    answerBox.value = "";
    answerBox.style.height = "";

    if (getAnswerBtn) {
      getAnswerBtn.disabled = false;
      getAnswerBtn.removeAttribute("aria-busy");
    }

    status("ጽሑፉ ተጽድቷል።", "Cleared.");
    questionInput.focus();
  });

  on(copyBtn, async () => {
    if (!answerBox.value.trim()) return;

    try {
      await navigator.clipboard.writeText(answerBox.value);
      status("መልሱ ተቀድቷል።", "Answer copied.", "ok");
    } catch {
      answerBox.focus();
      answerBox.select();

      status(
        "ጽሑፉ ተመርጧል። እባክዎ በእጅ ይቅዱ።",
        "Text selected. Please copy it manually.",
        "warn"
      );
    }
  });

  /* =========================================================
     TELEGRAM HELP
     ========================================================= */

  on(helpBtn, () => {
    window.open(TELEGRAM_BOT_URL, "_blank", "noopener,noreferrer");
  });

  /* =========================================================
     OPEN TELEGRAM WITH PRE-FILLED MESSAGE
     ========================================================= */

  function openTelegramWithMessage(message) {
    const telegramMessage = encodeURIComponent(message);

    window.open(
      `https://t.me/EbaMengistBot?text=${telegramMessage}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  /* =========================================================
     SCREEN SHARE REQUEST
     ========================================================= */

  on(screenShareBtn, async () => {
    const value = window.prompt(
      language === "am"
        ? "የስብሰባ ሊንክዎን ያስገቡ። ይህ በራሱ ስክሪንዎን አያጋራም።"
        : "Enter your meeting link. This does not automatically share your screen."
    );

    if (!value?.trim()) return;

    let meetingLink;

    try {
      const url = new URL(value.trim());

      if (url.protocol !== "https:") {
        throw new Error("HTTPS required");
      }

      meetingLink = url.href;
    } catch {
      status(
        "እባክዎ ትክክለኛ HTTPS ሊንክ ያስገቡ።",
        "Please enter a valid HTTPS meeting link.",
        "warn"
      );

      return;
    }

    const approved = window.confirm(
      language === "am"
        ? `ይህን ሊንክ ለድጋፍ ይላኩ?\n${meetingLink}`
        : `Send this meeting link to support?\n${meetingLink}`
    );

    if (!approved) return;

    screenShareBtn.disabled = true;

    const requestData = {
      chatId: getChatId(),
      meetingLink,
      source: "web"
    };

    try {
      await apiRequest("/api/screen-share", requestData);

      status(
        "የስብሰባ ሊንኩ ተልኳል።",
        "Your meeting-link request was submitted.",
        "ok"
      );
    } catch (error) {
      console.warn("Screen-share request failed:", error);

      openTelegramWithMessage(
        language === "am"
          ? `🖥️ የስክሪን ማጋራት ጥያቄ\n\nሊንክ፦ ${meetingLink}`
          : `🖥️ Screen-sharing request\n\nMeeting link: ${meetingLink}`
      );

      status(
        "ጥያቄው ወደ Telegram ተከፍቷል። እባክዎ Send ይጫኑ።",
        "Telegram opened with your request. Please press Send.",
        "warn"
      );
    } finally {
      screenShareBtn.disabled = false;
    }
  });

  /* =========================================================
     DOWNLOAD
     ========================================================= */

  on(downloadBtn, () => {
    const text = [
      "Learning and Employment / ትምህርት እና ሥራ",
      "Accessibility Hackathon 2026 Ethiopia",
      "",
      `Support: ${TELEGRAM_BOT_URL}`,
      "",
      questionInput.value ? `Question:\n${questionInput.value}` : "",
      answerBox.value ? `Answer:\n${answerBox.value}` : ""
    ].filter(Boolean).join("\n\n");

    const blob = new Blob(["\uFEFF", text], {
      type: "text/plain;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "Learning-and-Employment.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 10000);

    status(
      "የማውረድ ጥያቄው ተጀምሯል።",
      "Download requested.",
      "ok"
    );
  });

  /* =========================================================
     JOB ALERTS
     Sends to Railway. If Railway fails, opens Telegram.
     ========================================================= */

  jobAlertForm?.addEventListener("submit", async event => {
    event.preventDefault();

    const phone = $("jobPhone")?.value.trim() || "";
    const telegram = $("jobTelegram")?.value.trim() || "";
    const area = $("jobArea")?.value || "";
    const button = $("jobAlertBtn");

    if (!phone && !telegram) {
      status(
        "እባክዎ ስልክ ቁጥር ወይም Telegram ስም ያስገቡ።",
        "Please enter a phone number or Telegram username.",
        "warn"
      );

      return;
    }

    if (!area) {
      status(
        "እባክዎ የሥራ መስክ ይምረጡ።",
        "Please choose a job area.",
        "warn"
      );

      return;
    }

    button.disabled = true;

    const requestData = {
      chatId: getChatId(),
      phone,
      telegram,
      area,
      notify: true,
      source: "web"
    };

    try {
      await apiRequest("/api/job-alert", requestData);

      status(
        phone && telegram
          ? "✅ የሥራ ማሳወቂያ ተመዝግቧል። ማሳወቂያ ወደ ስልክዎ እና Telegram ይላካል።"
          : phone
            ? "✅ የሥራ ማሳወቂያ ተመዝግቧል። ማሳወቂያ ወደ ስልክዎ ይላካል።"
            : "✅ የሥራ ማሳወቂያ ተመዝግቧል። ማሳወቂያ ወደ Telegram ይላካል።",

        phone && telegram
          ? "✅ Job alerts registered. Notifications will be sent to your phone and Telegram."
          : phone
            ? "✅ Job alerts registered. Notifications will be sent to your phone."
            : "✅ Job alerts registered. Notifications will be sent to your Telegram.",

        "ok"
      );

      jobAlertForm.reset();
    } catch (error) {
      console.warn("Job alert failed:", error);

      const message = language === "am"
        ? `🔔 የሥራ ማሳወቂያ ጥያቄ\n\nስልክ፦ ${phone || "—"}\nTelegram፦ ${telegram || "—"}\nየሥራ መስክ፦ ${area}`
        : `🔔 Job alert request\n\nPhone: ${phone || "—"}\nTelegram: ${telegram || "—"}\nJob area: ${area}`;

      openTelegramWithMessage(message);

      status(
        "የሥራ ማሳወቂያ ጥያቄ ወደ Telegram ተከፍቷል። እባክዎ Send ይጫኑ።",
        "Job alert request opened in Telegram. Please press Send.",
        "warn"
      );
    } finally {
      button.disabled = false;
    }
  });

  /* =========================================================
     INTERVIEW SUPPORT
     Sends to Railway. If Railway fails, opens Telegram.
     ========================================================= */

  accommodationForm?.addEventListener("submit", async event => {
    event.preventDefault();

    const name = $("accommodationName")?.value.trim() || "";
    const phone = $("accommodationPhone")?.value.trim() || "";
    const type = $("accommodationType")?.value || "";
    const details = $("accommodationDetails")?.value.trim() || "";
    const button = $("accommodationBtn");

    if (!name) {
      status(
        "እባክዎ ሙሉ ስምዎን ይጻፉ።",
        "Please enter your full name.",
        "warn"
      );

      return;
    }

    if (!phone) {
      status(
        "እባክዎ ስልክ ቁጥርዎን ያስገቡ።",
        "Please enter your phone number.",
        "warn"
      );

      return;
    }

    if (!type) {
      status(
        "እባክዎ የሚፈልጉትን ድጋፍ ይምረጡ።",
        "Please choose the support you need.",
        "warn"
      );

      return;
    }

    button.disabled = true;

    const requestData = {
      chatId: getChatId(),
      name,
      phone,
      type,
      details,
      status: "requested",
      source: "web"
    };

    try {
      await apiRequest("/api/accommodation", requestData);

      status(
        "✅ የቃለ መጠይቅ ድጋፍ ጥያቄዎ ተልኳል። መምህር ወይም ድጋፍ ሰጪ ቡድን ወደ Telegram ይገናኛል።",
        "✅ Your interview support request has been sent. A teacher or support team will contact you on Telegram.",
        "ok"
      );

      accommodationForm.reset();
    } catch (error) {
      console.warn("Interview support request failed:", error);

      const message = language === "am"
        ? `♿️ የቃለ መጠይቅ ድጋፍ ጥያቄ\n\nስም፦ ${name}\nስልክ፦ ${phone}\nየሚፈልጉት ድጋፍ፦ ${type}\nዝርዝር፦ ${details || "—"}`
        : `♿️ Interview support request\n\nName: ${name}\nPhone: ${phone}\nSupport needed: ${type}\nDetails: ${details || "—"}`;

      openTelegramWithMessage(message);

      status(
        "የቃለ መጠይቅ ድጋፍ ጥያቄ ወደ Telegram ተከፍቷል። እባክዎ Send ይጫኑ።",
        "Interview support request opened in Telegram. Please press Send.",
        "warn"
      );
    } finally {
      button.disabled = false;
    }
  });

  /* =========================================================
     TEACHER ANALYTICS
     ========================================================= */

  async function loadTeacherStats() {
    if (!teacherStats) return;

    try {
      const data = await apiGet("/api/teacher-stats");
      const questions = data.questions || [];

      teacherStats.innerHTML = questions.length
        ? `<ol>${questions
            .map(
              item =>
                `<li>${item.question} — ${item.count}</li>`
            )
            .join("")}</ol>`
        : "<p>No questions yet.</p>";
    } catch {
      teacherStats.innerHTML =
        "<p>Teacher statistics are not available yet.</p>";
    }
  }

  /* =========================================================
     FINAL WEBSITE TEST
     ========================================================= */

  async function testWebsite() {
    const tests = [];

    function add(name, passed, details = "") {
      tests.push({ name, passed, details });
    }

    add(
      "HTML elements",
      Boolean(
        questionInput &&
        answerBox &&
        getAnswerBtn &&
        helpBtn &&
        screenShareBtn &&
        downloadBtn &&
        jobAlertForm &&
        accommodationForm
      )
    );

    add(
      "Offline course FAQ",
      Boolean(findCourseAnswer("What is downloading?"))
    );

    add(
      "Math engine",
      solveMath("25 * 4") === 100
    );

    add(
      "Railway API URL",
      API_BASE_URL.startsWith("https://")
    );

    add(
      "Telegram bot link",
      TELEGRAM_BOT_URL === "https://t.me/EbaMengistBot"
    );

    try {
      await apiGet("/health", 8000);
      add("Railway API connection", true);
    } catch {
      add(
        "Railway API connection",
        false,
        "Check that /health exists on your Railway server."
      );
    }

    console.table(tests);

    const failed = tests.filter(test => !test.passed);

    showAnswer(
      failed.length === 0
        ? bilingual(
            "✅ Website test passed. Railway API, Telegram link, course FAQ, and math are ready.",
            "✅ የድር ጣቢያ ሙከራ አልፏል። Railway API፣ Telegram ሊንክ፣ የትምህርት FAQ እና ሂሳብ ዝግጁ ናቸው።"
          )
        : bilingual(
            `⚠️ ${failed.length} test(s) failed. Open browser console for details.`,
            `⚠️ ${failed.length} ሙከራ አልተሳካም። ለዝርዝር የአሳሽ Console ይክፈቱ።`
          )
    );
  }

  // Open browser console and type:
  // testWebsite()
  window.testWebsite = testWebsite;

  /* =========================================================
     START
     ========================================================= */

  function start() {
    const settings = readSettings();

    language = settings.language === "en" ? "en" : "am";
    fontSize = Number(settings.fontSize) || 1.05;

    if (settings.highContrast === true) {
      document.body.classList.add("high-contrast");
    }

    updateContrastButton();
    applyLanguage();
    changeFontSize();
    loadTeacherStats();

    console.log(
      "Learning and Employment is ready. Run testWebsite() to test it."
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();