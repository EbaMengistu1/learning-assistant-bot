"use strict";

const API_BASE = "https://learning-assistant-bot-production.up.railway.app";

const questionInput = document.getElementById("question");

(() => {
  const INSTANCE_KEY = "__learningEmploymentWebFinal";
  if (window[INSTANCE_KEY]) return;
  window[INSTANCE_KEY] = true;

  function init() {
    /* =====================================================
       CONFIGURATION
       ===================================================== */

    const CONFIG = {
      apiBase:
        "https://learning-assistant-bot-production.up.railway.app",

      telegram: "https://t.me/EbaMengistuBot",

      /*
       * Optional supported speech endpoint.
       * Leave empty unless your backend implements it.
       *
       * POST { text, language: "am-ET" | "en-US" }
       * Response: audio bytes with an audio/* Content-Type.
       */
      speechPath: "",

      /*
       * Unofficial, best-effort fallback.
       * Answer text is sent to Google when used.
       */
      googleSpeechFallback: true,

      /*
       * Your current bot.js has no unsubscribe endpoint.
       * Leave empty to submit a support request instead.
       */
      unsubscribePath: ""
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

    const STORAGE_KEY = "learning_employment_web_settings";

    function loadSettings() {
      try {
        const value = JSON.parse(
          localStorage.getItem(STORAGE_KEY) || "{}"
        );
        return value && typeof value === "object" ? value : {};
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

    let lessons = [];
    let lessonsLoaded = false;
    let currentAnswer = null;
    let copiedQuestion = "";

    let answerVersion = 0;
    let answerController = null;

    let readingLanguage = null;
    let speechVersion = 0;
    let speechCancel = null;
    let speechController = null;
    let activeUtterance = null;
    let activeAudio = null;

    let microphone = null;
    let audioContext = null;

    const flashTimers = new WeakMap();
    const pendingForms = new WeakSet();

    function saveSetting(key, value) {
      settings[key] = value;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch {}
    }

    saveSetting("chatId", chatId);

    function on(id, callback) {
      $(id)?.addEventListener("click", callback);
    }

    function announce(text) {
      const live = $("liveRegion");
      if (live) live.textContent = text;
    }

    function status(
      id,
      am,
      en,
      type = "info",
      shouldAnnounce = true
    ) {
      const text = language === "am" ? am : en;
      const node = $(id);

      if (node) {
        node.textContent = text;
        node.className = `voice-status ${type}`;
      }

      /*
       * A visible role=status already announces its own text.
       * Avoid duplicating the same announcement.
       */
      if (shouldAnnounce && !node) announce(text);
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

    function normalizeText(text) {
      return String(text || "")
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[\u200b-\u200d\ufeff]/g, "")
        .replace(/\be[\s-]?mail\b/g, "email")
        .replace(/[፠-፨?؟!.,،;:'"“”‘’()[\]{}]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function safeHttpUrl(value) {
      try {
        const url = new URL(String(value));
        return ["https:", "http:"].includes(url.protocol)
          ? url.href
          : null;
      } catch {
        return null;
      }
    }

    function fieldValue(id) {
      return $(id)?.value.trim() || "";
    }

    function selectedMode() {
      return $("assistantMode")?.value === "career"
        ? "career"
        : "course";
    }

    function selectedLesson() {
      const value = $("lessonSelect")?.value || "";
      return lessons.find(item => item.key === value) || null;
    }

    function focusSection(id) {
      const section = $(id);
      if (!section) return;

      section.scrollIntoView({
        behavior: window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches ? "auto" : "smooth",
        block: "start"
      });
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
            raw.slice(0, 1200)
          );

          const error = new Error(`HTTP ${response.status}`);
          error.status = response.status;
          throw error;
        }

        let data;

        try {
          data = raw.trim() ? JSON.parse(raw) : {};
        } catch {
          throw new Error("The server returned a non-JSON response.");
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
       INTERFACE LANGUAGE
       ===================================================== */

    const labels = {
      am: {
        getAnswerBtn: "መልስ አግኝ",
        clearBtn: "አጽዳ",
        copyBtn: "ጥያቄውን ቅዳ",
        helpBtn: "እርዳታ አስፈልገኛል",
        screenShareBtn: "አማራጭ የስብሰባ ድጋፍ",
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
        screenShareBtn: "Optional meeting support",
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
      const badge = $("netBadge");
      if (!badge) return;

      const online = navigator.onLine !== false;

      badge.textContent = language === "am"
        ? online ? "ግንኙነት አለ" : "ከመስመር ውጭ"
        : online ? "Online" : "Offline";

      badge.style.color =
        document.body.classList.contains("high-contrast")
          ? "#ffd166"
          : online ? "#176139" : "#a32222";
    }

    function updateModeDescription() {
      const career = selectedMode() === "career";
      const node = $("modeDescription");

      if (node) {
        node.textContent = career
          ? language === "am"
            ? "የሥራ መመሪያ ሁኔታ፦ አጠቃላይ የሥራ ምክር ሊሰጥ ይችላል። የሥራ ዕድሎችንና መስፈርቶችን ከመጀመሪያው ምንጭ ያረጋግጡ።"
            : "Career guidance mode: general advice may be AI-generated. Verify vacancies and requirements with the original source."
          : language === "am"
            ? "የትምህርት ሁኔታ፦ መልሱ ከተፈቀደው ትምህርት መደገፍና ምንጭ ማሳየት አለበት።"
            : "Course mode: answers must be supported by approved lesson material and include a reference.";
      }

      if ($("lessonSelect")) {
        $("lessonSelect").disabled = career;
      }
    }

    function updateLanguage() {
      document.documentElement.lang = language;
      const t = labels[language];

      [
        "getAnswerBtn", "clearBtn", "copyBtn",
        "helpBtn", "screenShareBtn", "downloadBtn"
      ].forEach(id => {
        if ($(id)) $(id).textContent = t[id];
      });

      if ($("questionLabel")) {
        $("questionLabel").textContent =
          language === "am" ? "ጥያቄዎን ይጻፉ" : "Ask your question";
      }

      if ($("answerLabel")) {
        $("answerLabel").textContent =
          language === "am" ? "መልስ" : "Answer";
      }

      question.placeholder = language === "am"
        ? "ለምሳሌ፦ ኢሜይል ምንድን ነው?"
        : "Example: What is email?";

      answer.placeholder = language === "am"
        ? "መልሱ እዚህ ይታያል..."
        : "Your answer will appear here...";

      $("languageToggleBtn")?.setAttribute(
        "aria-label",
        language === "am"
          ? "Switch interface to English"
          : "የገጹን ቋንቋ ወደ አማርኛ ቀይር"
      );

      updateMediaButtons();
      updateConnection();
      updateModeDescription();
    }

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

    $("assistantMode")?.addEventListener("change", () => {
      stopReading();
      invalidateAnswerRequest();
      clearCurrentAnswer();
      updateModeDescription();
    });

    $("lessonSelect")?.addEventListener("change", () => {
      stopReading();
      invalidateAnswerRequest();
      clearCurrentAnswer();
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
       DELEGATED BUTTON EFFECTS
       Also covers lesson cards created later.
       ===================================================== */

    document.addEventListener("click", event => {
      const button = event.target.closest("button");
      if (!button || button.disabled) return;

      document.querySelectorAll("button.active-primary")
        .forEach(item => item.classList.remove("active-primary"));

      if (button.id === "getAnswerBtn") return;

      button.classList.add("active-primary");

      clearTimeout(flashTimers.get(button));
      button.classList.remove("button-flash");
      void button.offsetWidth;
      button.classList.add("button-flash");

      flashTimers.set(button, setTimeout(() => {
        button.classList.remove("button-flash");
      }, 650));
    });

    document.querySelectorAll("article.course-card button").forEach(button => {
  button.addEventListener("click", () => {
    const card = button.closest("article.course-card");

    const title =
      card?.querySelector("h3")?.textContent.trim() ||
      card?.querySelector("h2")?.textContent.trim() ||
      card?.querySelector(".course-title")?.textContent.trim() ||
      "";

    if (!title) {
      console.log("Course title not found");
      return;
    }

    questionInput.value =
      "Course material: " + title +
      ". What is " + title + "?";

    questionInput.focus();

    console.log("Question box filled with:", questionInput.value);
  });
});

    /* =====================================================
       LESSONS AND SAFE SOURCE RENDERING
       ===================================================== */

    function stringArray(value) {
      return Array.isArray(value)
        ? value.filter(item => typeof item === "string")
        : [];
    }

    const topicAliases = [
      [["downloading", "download"], ["ማውረድ", "ዳውንሎድ"]],
      [["uploading", "upload"], ["ፋይል መስቀል", "አፕሎድ"]],
      [["email"], ["ኢሜይል", "ኢሜል"]],
      [["internet"], ["ኢንተርኔት"]],
      [["browser", "web browser"], ["የድር አሳሽ", "ብሮውዘር"]],
      [["password", "passwords"], ["የይለፍ ቃል", "ፓስወርድ"]],
      [["cv", "resume"], ["ሲቪ"]]
    ];

    function lessonPhrases(item) {
      const phrases = [
        item.title,
        ...stringArray(item.keywords),
        ...stringArray(item.questions)
      ].filter(value => typeof value === "string")
        .map(normalizeText)
        .filter(Boolean);

      topicAliases.forEach(([english, amharic]) => {
        const related = english.some(term =>
          phrases.some(phrase =>
            ` ${phrase} `.includes(` ${normalizeText(term)} `)
          )
        );

        if (related) phrases.push(...amharic.map(normalizeText));
      });

      return [...new Set(phrases)];
    }

    function sourceForLesson(item) {
      const source = item.source;

      if (typeof source === "string") {
        return {
          label: source,
          url: safeHttpUrl(source)
        };
      }

      return {
        label: [
          source?.lesson || item.title || "Course lesson",
          source?.section || ""
        ].filter(Boolean).join(" — "),
        url: safeHttpUrl(source?.url || "")
      };
    }

    function lessonRecord(item) {
      const simple = $("simpleModeToggle")?.checked === true;

      return {
        am: String(
          simple
            ? item.simple?.am || item.answer?.am || ""
            : item.answer?.am || item.simple?.am || ""
        ).trim(),

        en: String(
          simple
            ? item.simple?.en || item.answer?.en || ""
            : item.answer?.en || item.simple?.en || ""
        ).trim(),

        sources: [sourceForLesson(item)],
        provider: "course",
        lessonTitle: item.title || ""
      };
    }

    function findDirectLesson(text) {
      const selected = selectedLesson();
      const candidates = selected ? [selected] : lessons;
      const normalized = normalizeText(text);
      const padded = ` ${normalized} `;

      let best = null;
      let bestScore = 0;
      let tied = false;

      for (const item of candidates) {
        const explicit = stringArray(item.questions)
          .map(normalizeText)
          .includes(normalized);

        const phrases = lessonPhrases(item);
        const exactTopic = phrases.includes(normalized);

        const definition =
          /^(what is |what are |define |explain |tell me about )/.test(normalized) ||
          /(?:ምንድን ነው|ምን ማለት ነው)$/.test(normalized) ||
          /^ስለ .+ አብራራልኝ$/.test(normalized);

        if (!explicit && !exactTopic && !definition) continue;

        let score = explicit ? 100 : 0;

        for (const phrase of phrases) {
          if (phrase === normalized) score += 30;
          else if (padded.includes(` ${phrase} `)) {
            score += 5 + phrase.split(" ").length;
          }
        }

        if (score > bestScore) {
          best = item;
          bestScore = score;
          tied = false;
        } else if (score > 0 && score === bestScore) {
          tied = true;
        }
      }

      return bestScore > 0 && !tied ? best : null;
    }

    function renderSources(container, sources) {
      if (!container) return;
      container.replaceChildren();

      if (!sources.length) {
        const p = document.createElement("p");
        p.textContent = "No course reference was supplied.";
        container.append(p);
        return;
      }

      const list = document.createElement("ul");

      sources.forEach(source => {
        const item = document.createElement("li");

        if (source.url) {
          const link = document.createElement("a");
          link.href = source.url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = source.label || source.url;
          item.append(link);
        } else {
          item.textContent = source.label;
        }

        list.append(item);
      });

      container.append(list);
    }

    async function loadLessons() {
      status(
        "courseStatus",
        "ትምህርቶች እየተጫኑ ነው...",
        "Loading the course library..."
      );

      try {
        const response = await fetch(`${API_BASE}/api/lessons`);

        if (!response.ok) {
          throw new Error(`Lesson request failed: ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data.lessons)) {
          throw new Error("Invalid lesson response.");
        }

        lessons = data.lessons
          .filter(item => item && typeof item === "object")
          .map((item, index) => ({
            ...item,
            key: String(item.id ?? `lesson-${index}`)
          }));

        lessonsLoaded = true;

        const select = $("lessonSelect");
        const previousSelection = select?.value || "";

        if (select) {
          select.replaceChildren();

          const all = document.createElement("option");
          all.value = "";
          all.textContent = "All approved lessons / ሁሉም ትምህርቶች";
          select.append(all);

          lessons.forEach(item => {
            const option = document.createElement("option");
            option.value = item.key;
            option.textContent = item.title || item.key;
            select.append(option);
          });

          if (lessons.some(item => item.key === previousSelection)) {
            select.value = previousSelection;
          }
        }

        const grid = $("courseGrid");
        grid?.replaceChildren();

        lessons.forEach(item => {
          if (!grid) return;

          const card = document.createElement("article");
          card.className = "course-card";

          const title = document.createElement("h3");
          title.textContent = item.title || "Course lesson";

          const source = document.createElement("p");
          source.textContent = sourceForLesson(item).label;

          const choose = document.createElement("button");
          choose.type = "button";
          choose.textContent = "Choose lesson / ትምህርቱን ምረጥ";

          choose.addEventListener("click", () => {
            if ($("assistantMode")) $("assistantMode").value = "course";
            if ($("lessonSelect")) $("lessonSelect").value = item.key;

            stopReading();
            invalidateAnswerRequest();
            clearCurrentAnswer();
            updateModeDescription();

            question.focus({ preventScroll: true });
            focusSection("assistantSection");
          });

          card.append(title, source, choose);
          grid.append(card);
        });

        status(
          "courseStatus",
          `${lessons.length} ትምህርቶች ተጭነዋል።`,
          `${lessons.length} lessons loaded.`,
          lessons.length ? "ok" : "warn"
        );
      } catch (error) {
        lessonsLoaded = false;

        status(
          "courseStatus",
          "ትምህርቶችን መጫን አልተቻለም።",
          "The course library could not load. Check the server.",
          "warn"
        );

        console.warn("Lessons:", error.message);
      }
    }

    /* =====================================================
       ACCESSIBLE CONVERSATION
       ===================================================== */

    function appendMessage(role, parts, sources = []) {
      const log = $("conversation");
      if (!log) return;

      const article = document.createElement("article");
      article.className = `chat-message ${role}`;
      article.dataset.role = role;

      const heading = document.createElement("p");
      heading.className = "message-role";
      heading.textContent = role === "user"
        ? "You / እርስዎ"
        : "Assistant / ረዳት";

      article.append(heading);

      parts.forEach(({ text, lang }) => {
        if (!text) return;

        const block = document.createElement("div");
        block.className = "message-language";
        block.lang = lang || detectLanguage(text);
        block.dir = "auto";

        const paragraph = document.createElement("p");
        paragraph.textContent = text;

        block.append(paragraph);
        article.append(block);
      });

      if (sources.length) {
        const reference = document.createElement("div");
        reference.className = "message-sources";
        renderSources(reference, sources);
        article.append(reference);
      }

      /*
       * Complete the node before appending so the live log
       * receives one coherent addition.
       */
      log.append(article);

      if ($("conversationEmpty")) {
        $("conversationEmpty").hidden = true;
      }

      /*
       * No automatic page scrolling or focus changes.
       * The learner controls when to inspect the log.
       */
    }

    function showAnswer(record, firstLanguage) {
      currentAnswer = record;

      const am = record.am ||
        "የአማርኛ ትርጉም ከአገልጋዩ አልተመለሰም።";

      const en = record.en ||
        "The server did not return an English translation.";

      const parts = firstLanguage === "am"
        ? [{ text: am, lang: "am" }, { text: en, lang: "en" }]
        : [{ text: en, lang: "en" }, { text: am, lang: "am" }];

      const sections = parts.map(part =>
        `${part.lang === "am" ? "አማርኛ" : "English"}\n${part.text}`
      );

      if (record.sources.length) {
        sections.push(
          "Source / ምንጭ:\n" +
          record.sources.map(source =>
            [source.label, source.url].filter(Boolean).join("\n")
          ).join("\n")
        );
      }

      const questionScroll = question.scrollTop;

      answer.value = sections.join("\n\n");
      answer.style.removeProperty("height");
      answer.scrollTop = 0;
      answer.scrollLeft = 0;

      question.scrollTop = questionScroll;

      renderSources($("answerSources"), record.sources);
      appendMessage("assistant", parts, record.sources);
    }

    function extractLanguage(text, lang) {
      return String(text || "")
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

    function normalizeApiAnswer(data) {
      const object = data.answer && typeof data.answer === "object"
        ? data.answer
        : data;

      let am = typeof object.answerAm === "string"
        ? object.answerAm.trim()
        : typeof object.am === "string" ? object.am.trim() : "";

      let en = typeof object.answerEn === "string"
        ? object.answerEn.trim()
        : typeof object.en === "string" ? object.en.trim() : "";

      const raw = typeof data.answer === "string"
        ? data.answer
        : typeof data.response === "string"
          ? data.response
          : typeof data.text === "string" ? data.text : "";

      if (!am && !en && raw) {
        am = extractLanguage(raw, "am");
        en = extractLanguage(raw, "en");
      }

      if (!am && !en) throw new Error("No readable answer returned.");

      const sources = [];

      if (Array.isArray(data.sources)) {
        data.sources.forEach(source => {
          if (typeof source === "string") {
            sources.push({
              label: source,
              url: safeHttpUrl(source)
            });
          } else if (source && typeof source === "object") {
            sources.push({
              label: String(
                source.label || source.lesson || source.title || "Reference"
              ),
              url: safeHttpUrl(source.url || "")
            });
          }
        });
      } else if (typeof data.source === "string" && data.source.trim()) {
        sources.push({
          label: data.source.trim(),
          url: safeHttpUrl(data.source.trim())
        });
      }

      return {
        am,
        en,
        sources,
        provider: data.provider || "",
        lessonTitle: data.lessonTitle || "",
        grounded: data.grounded === true,
        lessonId: data.lessonId == null ? "" : String(data.lessonId)
      };
    }

    function courseRefusal() {
      return {
        am:
          "ከተጫነው የትምህርት መረጃ ለዚህ ጥያቄ የተደገፈ መልስ ማረጋገጥ አልቻልኩም። ሌላ ትምህርት ይምረጡ ወይም የሰው ድጋፍ ይጠይቁ።",
        en:
          "I could not verify a supported answer from the available course material. Choose another lesson or request human help.",
        sources: [],
        provider: "course-refusal"
      };
    }

    function courseResponseAllowed(record, selected) {
      /*
      * Allow approved course answers and Groq-assisted answers.
      * The backend clearly labels general Groq answers as
      * non-course citations, so the user can see the source type.
      */
      if (record.provider === "course") {
        return Boolean(record.sources.length);
      }

      if (record.provider === "groq") {
        return true;
      }

      return false;
    }

    function invalidateAnswerRequest() {
      answerVersion++;
      answerController?.abort();
      answerController = null;
      busy($("getAnswerBtn"), false);
    }

    function clearCurrentAnswer() {
      currentAnswer = null;
      answer.value = "";
      answer.scrollTop = 0;
      answer.style.removeProperty("height");
      renderSources($("answerSources"), []);
    }

    async function getAnswer() {
      const text = question.value.trim();

      if (!text || text.length > 6000) {
        status(
          "voiceStatus",
          "ከ1 እስከ 6000 ቁምፊዎች ያለውን ጥያቄ ይጻፉ።",
          "Enter a question between 1 and 6,000 characters.",
          "warn"
        );
        question.focus({ preventScroll: true });
        return;
      }

      stopReading();
      stopMicrophone();
      invalidateAnswerRequest();

      const version = answerVersion;
      const firstLanguage = detectLanguage(text);
      const mode = selectedMode();
      const selected = selectedLesson();

      appendMessage("user", [{ text, lang: firstLanguage }]);

      if (mode === "course" && lessonsLoaded) {
        const local = findDirectLesson(text);

        if (local) {
          const record = lessonRecord(local);

          if (record.am && record.en) {
            showAnswer(record, firstLanguage);

            status(
              "voiceStatus",
              "መልሱ ከተጫነው ትምህርት ተገኝቷል።",
              "Answer found in the loaded course material.",
              "ok"
            );
            return;
          }
        }
      }

      currentAnswer = null;
      answer.value = firstLanguage === "am"
        ? "መልስ እየተጠየቀ ነው..."
        : "Requesting an answer...";

      answer.scrollTop = 0;
      busy($("getAnswerBtn"), true);

      const controller = new AbortController();
      answerController = controller;

      const payload = {
        chatId,
        question: text,
        language: firstLanguage,
        mode,
        simpleMode: $("simpleModeToggle")?.checked === true,
        responseLanguages: ["am", "en"]
      };

      if (selected) payload.lessonId = selected.key;

      try {
        const data = await api("/api/ask", {
          method: "POST",
          body: payload,
          signal: controller.signal
        });

        if (version !== answerVersion) return;

        let record = normalizeApiAnswer(data);

        if (
          mode === "course" &&
          !courseResponseAllowed(record, selected)
        ) {
          record = courseRefusal();
        }

        showAnswer(record, firstLanguage);

        status(
          "voiceStatus",
          record.provider === "course-refusal"
            ? "የትምህርት ድጋፉ አልተረጋገጠም። የሰው ድጋፍ መጠየቅ ይችላሉ።"
            : "መልሱ ዝግጁ ነው።",
          record.provider === "course-refusal"
            ? "Course support was not verified. Human help is available."
            : mode === "career"
              ? "Career answer ready. Verify important details with the original source."
              : "Your answer is ready.",
          record.provider === "course-refusal" ? "warn" : "ok"
        );
      } catch (error) {
        if (version !== answerVersion) return;

        const am = error.status === 404
          ? "የመልስ አገልጋዩ መንገድ አልተገኘም።"
          : "ከአገልጋዩ መልስ ማግኘት አልተቻለም። እንደገና ይሞክሩ ወይም የሰው ድጋፍ ይጠይቁ።";

        const en = error.status === 404
          ? "The answer route was not found. Check the Railway deployment."
          : "The answer request failed. Try again or request human help.";

        showAnswer({
          am,
          en,
          sources: [],
          provider: "error"
        }, firstLanguage);

        status(
          "voiceStatus",
          "ጥያቄው አልተሳካም።",
          "The request did not complete.",
          "warn"
        );

        console.warn("Answer request:", error.message);
      } finally {
        if (version === answerVersion) {
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
       READING — ONE OUTPUT AT A TIME
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
          "voiceStatus",
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
            "voiceStatus",
            "የመስመር ላይ የንባብ አገልግሎት እየተሞከረ ነው...",
            "Trying online speech. Answer text will be sent to Google."
          );

          await googleSpeech(text, lang, run);
        } else {
          status(
            "voiceStatus",
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
          "voiceStatus",
          "የድምፅ ንባቡ አልተሳካም።",
          "Reading was unavailable. Check the device voice or speech service.",
          "warn"
        );

        console.warn("Reading:", error.message);
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
          "voiceStatus",
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

        status(
          "voiceStatus",
          "እባክዎ ይናገሩ።",
          "Listening. Please speak."
        );
      };

      recognizer.onresult = event => {
        if (microphone !== session) return;

        const text = Array.from(event.results)
          .map(result => result[0].transcript)
          .join(" ")
          .trim();

        question.value = [
          question.value.trim(),
          text
        ].filter(Boolean).join(" ");

        status(
          "voiceStatus",
          "ጥያቄዎ ተጽፏል። መልስ አግኝ ይጫኑ።",
          "Your words were added. Press Get Answer.",
          "ok"
        );
      };

      recognizer.onerror = event => {
        if (microphone === session && event.error !== "aborted") {
          status(
            "voiceStatus",
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
          "voiceStatus",
          "ማይክሮፎኑን መጀመር አልተቻለም።",
          "The microphone could not start.",
          "warn"
        );
      }
    }

    on("voiceAmharicBtn", () => startMicrophone("am"));
    on("voiceEnglishBtn", () => startMicrophone("en"));

    /* =====================================================
       CLEAR / COPY / DOWNLOAD
       ===================================================== */

    on("clearBtn", () => {
      invalidateAnswerRequest();
      stopReading();
      stopMicrophone();

      question.value = "";
      question.scrollTop = 0;
      copiedQuestion = "";
      clearCurrentAnswer();

      status(
        "voiceStatus",
        "ጥያቄውና መልሱ ተጽድተዋል።",
        "Question and answer cleared. Conversation history is unchanged."
      );

      question.focus({ preventScroll: true });
    });

    on("clearHistoryBtn", () => {
      $("conversation")?.replaceChildren();
      if ($("conversationEmpty")) $("conversationEmpty").hidden = false;

      announce(
        language === "am"
          ? "የውይይት ታሪኩ ተጽድቷል።"
          : "Conversation history cleared from this page."
      );
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
          "voiceStatus",
          "መጀመሪያ ጥያቄ ይጻፉ።",
          "Please type a question first.",
          "warn"
        );
        return;
      }

      copiedQuestion = text;
      const copied = await copyText(text);

      status(
        "voiceStatus",
        copied ? "ጥያቄው ተቀድቷል።" : "ጥያቄው ለእርዳታ ተዘጋጅቷል።",
        copied
          ? "Question copied."
          : "Saved for Help, but clipboard access was unavailable.",
        copied ? "ok" : "warn"
      );
    });

    on("downloadBtn", () => {
      const content =
        "Learning and Employment / ትምህርት እና ሥራ\n\n" +
        `Question:\n${question.value}\n\nAnswer:\n${answer.value}`;

      const url = URL.createObjectURL(new Blob(["\uFEFF", content], {
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

    /* =====================================================
       FORM UTILITIES
       ===================================================== */

    function validInternationalPhone(value) {
      return /^\+[1-9]\d{7,14}$/.test(
        String(value).replace(/[\s()-]/g, "")
      );
    }

    function normalizePhone(value) {
      return String(value).replace(/[\s()-]/g, "");
    }

    function clearForm(form) {
      form.reset();

      form.querySelectorAll("input, textarea, select").forEach(field => {
        if (field instanceof HTMLSelectElement) {
          field.selectedIndex = 0;
        } else if (["checkbox", "radio"].includes(field.type)) {
          field.checked = false;
        } else if (!["button", "submit", "hidden"].includes(field.type)) {
          field.value = "";
        }
      });
    }

    function referenceFrom(data) {
      const value = data.requestId || data.reference || data.subscriptionId;
      return value == null ? "" : String(value);
    }

    async function submitRequest({
      form,
      buttonId,
      statusId,
      path,
      payload,
      successAm,
      successEn,
      onSuccess
    }) {
      if (pendingForms.has(form)) return;

      pendingForms.add(form);
      busy($(buttonId), true);

      status(
        statusId,
        "ጥያቄዎ እየተላከ ነው...",
        "Submitting your request..."
      );

      try {
        const data = await api(path, {
          method: "POST",
          body: payload
        });

        clearForm(form);

        status(statusId, successAm, successEn, "ok");
        onSuccess?.(data);
      } catch (error) {
        status(
          statusId,
          "ጥያቄው መቀበሉ አልተረጋገጠም። መረጃዎ አልተጽዳም። Telegram ወይም እንደገና መሞከር ይችላሉ።",
          "Submission was not confirmed. Your fields were kept. Try again or contact the Telegram support bot.",
          "warn"
        );

        console.warn(path, error.message);
      } finally {
        pendingForms.delete(form);
        busy($(buttonId), false);
      }
    }

    /* =====================================================
       HUMAN HELP
       Contact is included in question text for compatibility
       with the current /api/help implementation.
       ===================================================== */

    on("helpBtn", () => {
      stopReading();
      stopMicrophone();

      if ($("helpQuestion")) {
        $("helpQuestion").value =
          question.value.trim() || copiedQuestion;
      }

      focusSection("humanHelpSection");

      $("helpQuestion")?.focus({ preventScroll: true });
    });

    const helpForm = $("humanHelpForm");

    helpForm?.addEventListener("submit", event => {
      event.preventDefault();
      if (!helpForm.reportValidity()) return;

      const text = fieldValue("helpQuestion");
      const method = fieldValue("helpContactMethod");
      const contact = fieldValue("helpContact");

      if (!text || !contact || !$("helpConsent")?.checked) return;

      const validContact =
        method === "phone"
          ? validInternationalPhone(contact)
          : method === "email"
            ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)
            : method === "telegram"
              ? /^@?[A-Za-z0-9_]{5,32}$/.test(contact)
              : false;

      if (!validContact) {
        status(
          "humanHelpStatus",
          "ከተመረጠው የመገናኛ ዓይነት ጋር የሚጣጣም ትክክለኛ መረጃ ያስገቡ።",
          "Enter valid contact details for the selected contact method.",
          "warn"
        );
        return;
      }

      submitRequest({
        form: helpForm,
        buttonId: "humanHelpSubmitBtn",
        statusId: "humanHelpStatus",
        path: "/api/help",
        payload: {
          chatId,
          question:
            `Question:\n${text}\n\nReply method: ${method}\n` +
            `Contact: ${contact}\nConsent: provided`,
          contactMethod: method,
          contact,
          consent: true
        },
        successAm:
          "የእርዳታ ጥያቄዎ ተቀብሏል። የምላሽ ጊዜ የተለያየ ሊሆን ይችላል።",
        successEn:
          "Your help request was accepted. Response times may vary.",
        onSuccess(data) {
          const reference = referenceFrom(data);

          if ($("helpRequestReference")) {
            $("helpRequestReference").textContent = reference
              ? `Request reference: ${reference}`
              : "The server did not issue a request reference.";
          }
        }
      });
    });

    $("telegramSupportLink")?.addEventListener("click", event => {
      const text =
        fieldValue("helpQuestion") ||
        question.value.trim() ||
        copiedQuestion;

      const url = new URL(CONFIG.telegram);

      if (text) {
        url.searchParams.set(
          "text",
          `Learning support request\n\nQuestion:\n${text}`
        );
      }

      event.currentTarget.href = url.href;
    });

    /* =====================================================
       OPTIONAL MEETING SUPPORT
       ===================================================== */

    on("screenShareBtn", () => {
      stopReading();
      stopMicrophone();
      focusSection("screenShareSection");
      $("meetingLink")?.focus({ preventScroll: true });
    });

    const screenForm = $("screenShareForm");

    screenForm?.addEventListener("submit", event => {
      event.preventDefault();
      if (!screenForm.reportValidity()) return;

      let meetingLink;

      try {
        const url = new URL(fieldValue("meetingLink"));
        if (url.protocol !== "https:") throw new Error();
        meetingLink = url.href;
      } catch {
        status(
          "screenShareStatus",
          "ትክክለኛ HTTPS ሊንክ ያስገቡ።",
          "Enter a valid HTTPS meeting link.",
          "warn"
        );
        return;
      }

      if (!$("screenShareConsent")?.checked) return;

      submitRequest({
        form: screenForm,
        buttonId: "screenShareSubmitBtn",
        statusId: "screenShareStatus",
        path: "/api/screen-share",
        payload: {
          chatId,
          meetingLink,
          consent: true
        },
        successAm:
          "የስብሰባ ሊንኩ ተቀብሏል። ስክሪን ማጋራት አልተጀመረም።",
        successEn:
          "Your meeting-link request was accepted. Screen sharing has not started."
      });
    });

    /* =====================================================
       JOB ALERT REQUESTS
       The current backend forwards a request, not a verified
       active subscription.
       ===================================================== */

    const jobForm = $("jobAlertForm");

    jobForm?.addEventListener("submit", event => {
      event.preventDefault();
      if (!jobForm.reportValidity()) return;

      const channels = [
        $("jobChannelTelegram")?.checked ? "telegram" : "",
        $("jobChannelSms")?.checked ? "sms" : ""
      ].filter(Boolean);

      const phone = normalizePhone(fieldValue("jobPhone"));
      const telegram = fieldValue("jobTelegram");
      const area = fieldValue("jobArea");
      const location = fieldValue("jobLocation");

      if (
        !channels.length ||
        (channels.includes("sms") && !validInternationalPhone(phone)) ||
        (channels.includes("telegram") && !/^@?[A-Za-z0-9_]{5,32}$/.test(telegram)) ||
        !$("jobAlertConsent")?.checked
      ) {
        status(
          "jobAlertStatus",
          "የማሳወቂያ መንገድ ይምረጡና ለዚያ መንገድ ትክክለኛ የመገናኛ መረጃ ያስገቡ።",
          "Choose at least one channel and enter valid contact details for each selected channel.",
          "warn"
        );
        return;
      }

      /*
       * Current backend forwards area/phone/telegram only.
       * Include preferences in area so the support admin sees
       * them until dedicated storage fields are implemented.
       */
      const requestArea =
        `${area}; location: ${location || "not specified"}; ` +
        `channels: ${channels.join(", ")}; consent: provided`;

      submitRequest({
        form: jobForm,
        buttonId: "jobAlertBtn",
        statusId: "jobAlertStatus",
        path: "/api/job-alert",
        payload: {
          chatId,
          phone,
          telegram,
          area: requestArea,
          jobArea: area,
          location,
          channels,
          consent: true,
          consentAt: new Date().toISOString()
        },
        successAm:
          "የሥራ ማሳወቂያ ጥያቄዎ ተቀብሏል። ምዝገባው ገቢር መሆኑ ገና አልተረጋገጠም።",
        successEn:
          "Your job-alert request was accepted. This does not confirm an active subscription or notification delivery."
      });
    });

    /* =====================================================
       UNSUBSCRIBE
       No fake success when a subscription endpoint is absent.
       ===================================================== */

    const unsubscribeForm = $("unsubscribeForm");

    unsubscribeForm?.addEventListener("submit", event => {
      event.preventDefault();
      if (!unsubscribeForm.reportValidity()) return;

      const contact = fieldValue("unsubscribeContact");

      const configured = Boolean(CONFIG.unsubscribePath);

      submitRequest({
        form: unsubscribeForm,
        buttonId: "unsubscribeBtn",
        statusId: "unsubscribeStatus",
        path: configured ? CONFIG.unsubscribePath : "/api/help",
        payload: configured
          ? { chatId, contact }
          : {
              chatId,
              question:
                "UNSUBSCRIBE REQUEST\n" +
                `Registered contact or reference: ${contact}\n` +
                "Please stop job-alert notifications for this subscription."
            },
        successAm:
          "የማቋረጥ ጥያቄዎ ተቀብሏል። አገልግሎቱ መቋረጡን ድጋፍ ሰጪው ማረጋገጥ ያስፈልጋል።",
        successEn:
          "Your unsubscribe request was accepted for handling. Support must confirm that notifications have stopped."
      });
    });

    /* =====================================================
       INTERVIEW ACCOMMODATIONS
       ===================================================== */

    const accommodationForm = $("accommodationForm");

    accommodationForm?.addEventListener("submit", event => {
      event.preventDefault();
      if (!accommodationForm.reportValidity()) return;

      const name = fieldValue("accommodationName");
      const phone = normalizePhone(fieldValue("accommodationPhone"));
      const type = fieldValue("accommodationType");
      const details = fieldValue("accommodationDetails");

      if (
        !validInternationalPhone(phone) ||
        !$("accommodationConsent")?.checked
      ) {
        status(
          "accommodationStatus",
          "ትክክለኛ ዓለም አቀፍ ስልክ ቁጥር ያስገቡና ፈቃድዎን ያረጋግጡ።",
          "Enter a valid international phone number and confirm consent.",
          "warn"
        );
        return;
      }

      const accommodation =
        `Name: ${name}\nPhone: ${phone}\nSupport: ${type}\n` +
        `Details: ${details || "Not provided"}\nConsent: provided`;

      submitRequest({
        form: accommodationForm,
        buttonId: "accommodationBtn",
        statusId: "accommodationStatus",
        path: "/api/accommodation",
        payload: {
          chatId,
          accommodation,
          name,
          phone,
          type,
          details,
          consent: true
        },
        successAm:
          "የድጋፍ ጥያቄዎ ተቀብሏል። የተጠየቀው ድጋፍ መዘጋጀቱ ገና አልተረጋገጠም።",
        successEn:
          "Your request was accepted. This does not confirm that the accommodation has been arranged."
      });
    });

    /* =====================================================
       JOB LISTINGS — SAFE DEMO / EXPIRED LABELS
       ===================================================== */

    async function loadJobs() {
      busy($("refreshJobsBtn"), true);

      status(
        "jobsStatus",
        "የሥራ ዝርዝር እየተጫነ ነው...",
        "Loading job listings..."
      );

      try {
        const data = await api("/api/jobs");

        const jobs = Array.isArray(data.jobs) ? data.jobs : [];
        const grid = $("jobsGrid");
        grid?.replaceChildren();

        jobs.forEach(job => {
          if (!grid || !job || typeof job !== "object") return;

          const card = document.createElement("article");
          card.className = "job-card";

          const title = document.createElement("h3");
          title.textContent = job.title || "Job listing";

          const demo = data.demo === true || job.demo === true;
          const deadline = typeof job.deadline === "string"
            ? job.deadline
            : "";

          const validDate = /^\d{4}-\d{2}-\d{2}$/.test(deadline);
          const expired = validDate &&
            new Date(`${deadline}T23:59:59Z`).getTime() < Date.now();

          if (demo || expired) {
            const badge = document.createElement("span");
            badge.className = "demo-badge";
            badge.textContent = demo
              ? "DEMONSTRATION — not a verified vacancy"
              : "Deadline passed";
            card.append(badge);
          }

          const meta = document.createElement("p");
          meta.className = "job-meta";
          meta.textContent = [
            job.organization,
            job.location,
            job.type,
            deadline && `Deadline: ${deadline}`
          ].filter(Boolean).join(" · ");

          card.append(title, meta);

          const url = safeHttpUrl(job.link || "");

          if (url && !demo && !expired) {
            const link = document.createElement("a");
            link.className = "course-link";
            link.href = url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "View original listing";
            card.append(link);
          } else {
            const note = document.createElement("p");
            note.textContent = demo
              ? "Example only. Do not treat this as an application opportunity."
              : expired
                ? "Check the employer for current opportunities."
                : "No valid application link was supplied.";

            card.append(note);
          }

          grid.append(card);
        });

        status(
          "jobsStatus",
          `${jobs.length} ዝርዝሮች ተጭነዋል። የምሳሌ ምልክቶችን ያስተውሉ።`,
          `${jobs.length} listings loaded. Check demonstration labels and original sources.`,
          jobs.length ? "ok" : "warn"
        );
      } catch (error) {
        status(
          "jobsStatus",
          "የሥራ ዝርዝሩን መጫን አልተቻለም።",
          "Job listings could not load.",
          "warn"
        );

        console.warn("Jobs:", error.message);
      } finally {
        busy($("refreshJobsBtn"), false);
      }
    }

    on("refreshJobsBtn", loadJobs);

    /* =====================================================
       AGGREGATE TEACHER TOPICS
       ===================================================== */

    async function loadTeacherStats() {
      const container = $("teacherStats");
      if (!container) return;

      busy($("refreshTeacherStatsBtn"), true);

      try {
        const data = await api("/api/teacher-stats");

        /*
         * Latest bot.js explicitly marks aggregate topic data.
         * Do not render an unknown older endpoint containing
         * raw learner questions.
         */
        if (data.aggregateOnly !== true) {
          throw new Error("Aggregate-only response was not confirmed.");
        }

        const topics = Array.isArray(data.questions)
          ? data.questions.slice(0, 20)
          : [];

        container.replaceChildren();

        if (!topics.length) {
          const p = document.createElement("p");
          p.textContent = "No aggregate lesson-topic counts yet.";
          container.append(p);
        } else {
          const list = document.createElement("ol");

          topics.forEach(item => {
            const row = document.createElement("li");
            row.textContent =
              `${String(item.question || "Topic")} — ${Number(item.count) || 0}`;
            list.append(row);
          });

          container.append(list);
        }

        status(
          "teacherStatsStatus",
          "የተጠቃለሉ የርዕስ ቆጠራዎች ተጭነዋል።",
          "Aggregate topic counts loaded. In-memory counts may reset on server restart.",
          "ok"
        );
      } catch (error) {
        container.textContent =
          "Anonymous aggregate statistics are unavailable.";

        status(
          "teacherStatsStatus",
          "የተጠቃለሉ መረጃዎችን መጫን አልተቻለም።",
          "Aggregate statistics could not be verified or loaded.",
          "warn"
        );

        console.warn("Teacher statistics:", error.message);
      } finally {
        busy($("refreshTeacherStatsBtn"), false);
      }
    }

    on("refreshTeacherStatsBtn", loadTeacherStats);

    /* =====================================================
       DIAGNOSTICS
       ===================================================== */

    window.explainLessonMatch = text => {
      const match = findDirectLesson(text);

      const result = {
        original: text,
        normalized: normalizeText(text),
        selectedLesson: selectedLesson()?.title || "All lessons",
        match: match?.title || null,
        nextStep: match ? "Approved lesson text" : "Backend request"
      };

      console.table([result]);
      return result;
    };

    window.testWebsite = async () => {
      const results = [];

      [
        "question", "answer", "getAnswerBtn", "clearBtn",
        "copyBtn", "conversation", "assistantMode", "lessonSelect",
        "simpleModeToggle", "humanHelpForm", "screenShareForm",
        "jobAlertForm", "unsubscribeForm", "accommodationForm",
        "speakAmharicBtn", "speakEnglishBtn"
      ].forEach(id => {
        const count =
          document.querySelectorAll(`[id="${id}"]`).length;

        results.push({
          test: `Unique #${id}`,
          passed: count === 1,
          details: `Found ${count}`
        });
      });

      results.push({
        test: "Course library loaded",
        passed: lessonsLoaded && lessons.length > 0,
        details: `${lessons.length} lessons`
      });

      results.push({
        test: "Question direction",
        passed: question.getAttribute("dir") === "auto",
        details: ""
      });

      const voices = window.speechSynthesis?.getVoices() || [];

      results.push({
        test: "Amharic device voice",
        passed: Boolean(chooseVoice(voices, "am")),
        details: "Online fallback may be needed."
      });

      results.push({
        test: "English device voice",
        passed: Boolean(chooseVoice(voices, "en")),
        details: ""
      });

      try {
        const health = await api("/api/health", { timeout: 8000 });

        results.push({
          test: "API health",
          passed: health.status === "ok",
          details: "Does not verify Groq or delivery."
        });
      } catch (error) {
        results.push({
          test: "API health",
          passed: false,
          details: error.message
        });
      }

      console.table(results);
      return results;
    };

    window.testBackendFallback = async (
      text = "ለቃለ መጠይቅ ሦስት የዝግጅት ምክሮችን ስጠኝ።"
    ) => {
      /*
       * Explicit manual POST test. May incur AI usage.
       * It does not display the answer or submit support forms.
       */
      try {
        const data = await api("/api/ask", {
          method: "POST",
          body: {
            chatId,
            question: String(text),
            language: detectLanguage(String(text)),
            mode: "career",
            responseLanguages: ["am", "en"]
          }
        });

        const record = normalizeApiAnswer(data);

        console.table([{
          requestSucceeded: true,
          amharicPresent: Boolean(record.am),
          englishPresent: Boolean(record.en),
          reportedProvider: record.provider,
          note: "Check server logs for actual provider invocation."
        }]);

        return data;
      } catch (error) {
        console.error("Backend test failed:", error);
        return {
          requestSucceeded: false,
          status: error.status || null,
          message: error.message
        };
      }
    };

    /* =====================================================
       INITIALIZATION / CLEANUP
       ===================================================== */

    document.body.classList.toggle(
      "high-contrast",
      settings.highContrast === true
    );

    $("contrastBtn")?.setAttribute(
      "aria-pressed",
      String(settings.highContrast === true)
    );

    if ($("simpleModeToggle")) {
      $("simpleModeToggle").checked = settings.simpleMode === true;

      $("simpleModeToggle").addEventListener("change", () => {
        saveSetting(
          "simpleMode",
          $("simpleModeToggle").checked
        );
      });
    }

    applyFont();
    updateLanguage();

    Promise.allSettled([
      loadLessons(),
      loadJobs(),
      loadTeacherStats()
    ]);

    window.addEventListener("pagehide", () => {
      invalidateAnswerRequest();
      stopReading();
      stopMicrophone();
    });

    console.info(
      "Learning assistant initialized once. Run testWebsite() for diagnostics."
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");

  if (!button) return;

  const buttonText = button.textContent.trim().toLowerCase();

  if (
    !buttonText.includes("choose lesson") &&
    !buttonText.includes("ትምህርት ምረጥ")
  ) {
    return;
  }

  const card = button.closest("article");

  if (!card) return;

  const title =
    card.querySelector("h3")?.textContent.trim() ||
    card.querySelector("h2")?.textContent.trim() ||
    card.querySelector(".course-title")?.textContent.trim() ||
    "";

  if (!title) return;

  const questionInput = document.getElementById("question");

  if (!questionInput) return;

  questionInput.value =
    "Course material: " + title +
    ". What is " + title + "?";

  questionInput.focus();

  questionInput.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
});