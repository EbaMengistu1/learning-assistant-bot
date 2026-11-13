"use strict";

(() => {
  const APP_KEY = "__learningEmploymentBilingual";

  if (window[APP_KEY]) return;
  window[APP_KEY] = true;

  function init() {
    /* =====================================================
       CONFIGURATION
       ===================================================== */

    const CONFIG = {
      apiBase:
        "https://learning-assistant-bot-production.up.railway.app",

      /*
       * This path must match a REAL route on your backend.
       * Your reported 404 means this connection still needs
       * verification. Do not guess a different route.
       */
      answerPath: "/api/ask",

      telegram: "https://t.me/EbaMengistuBot",

      /*
       * Optional speech route.
       * Leave empty unless implemented on your backend.
       *
       * POST { text, language: "am-ET" | "en-US" }
       * Return audio bytes with an audio/* Content-Type.
       */
      speechPath: ""
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

    const SETTINGS_KEY = "learning_bilingual_settings";

    function readSettings() {
      try {
        const data = JSON.parse(
          localStorage.getItem(SETTINGS_KEY) || "{}"
        );

        return data && typeof data === "object" ? data : {};
      } catch {
        return {};
      }
    }

    const settings = readSettings();

    let language = settings.language === "en" ? "en" : "am";

    let fontSize = Math.max(
      0.9,
      Math.min(1.8, Number(settings.fontSize) || 1.05)
    );

    const chatId =
      settings.chatId ||
      `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    let currentAnswer = null;
    let copiedQuestion = "";

    let requestVersion = 0;
    let requestController = null;

    let readingLanguage = null;
    let speechVersion = 0;
    let cancelSpeech = null;
    let speechController = null;
    let activeUtterance = null;
    let activeAudio = null;

    let microphone = null;
    let audioContext = null;

    function saveSetting(key, value) {
      settings[key] = value;

      try {
        localStorage.setItem(
          SETTINGS_KEY,
          JSON.stringify(settings)
        );
      } catch {
        // Local storage is optional.
      }
    }

    saveSetting("chatId", chatId);

    const on = (id, handler) => {
      $(id)?.addEventListener("click", handler);
    };

    function status(am, en, type = "info", target = $("voiceStatus")) {
      const text = language === "am" ? am : en;

      if (target) {
        target.textContent = text;
        target.className = `voice-status ${type}`;
      }

      if ($("liveRegion")) {
        $("liveRegion").textContent = text;
      }
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
       BUTTON EFFECTS
       ===================================================== */

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

    /* =====================================================
       INTERFACE LANGUAGE
       ===================================================== */

    const labels = {
      am: {
        question: "ጥያቄዎን ይጻፉ",
        answer: "መልስ",
        placeholder: "ለምሳሌ፦ ማውረድ ምን ማለት ነው?",
        getAnswerBtn: "መልስ አግኝ",
        clearBtn: "አጽዳ",
        copyBtn: "ጥያቄውን ቅዳ",
        helpBtn: "እርዳታ አስፈልገኛል",
        downloadBtn: "አውርድ",
        screenShareBtn: "የስብሰባ ሊንክ ላክ",
        readAm: "አማርኛ አንብብ",
        readEn: "English አንብብ",
        micAm: "በአማርኛ ተናገር",
        micEn: "በእንግሊዝኛ ተናገር",
        stop: "አቁም",
        listening: "እያዳመጥኩ ነው..."
      },

      en: {
        question: "Ask your question",
        answer: "Answer",
        placeholder: "Example: What is downloading?",
        getAnswerBtn: "Get Answer",
        clearBtn: "Clear",
        copyBtn: "Copy Question",
        helpBtn: "I Need Help",
        downloadBtn: "Download",
        screenShareBtn: "Send Meeting Link",
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

      const qLabel = document.querySelector('label[for="question"]');
      const aLabel = document.querySelector('label[for="answer"]');

      if (qLabel) qLabel.textContent = t.question;
      if (aLabel) aLabel.textContent = t.answer;

      question.placeholder = t.placeholder;

      answer.placeholder = language === "am"
        ? "መልሱ እዚህ ይታያል..."
        : "Your answer will appear here...";

      [
        "getAnswerBtn",
        "clearBtn",
        "copyBtn",
        "helpBtn",
        "downloadBtn",
        "screenShareBtn"
      ].forEach(id => {
        if ($(id)) $(id).textContent = t[id];
      });

      updateMediaButtons();
      updateConnection();
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

      $("contrastBtn")?.setAttribute(
        "aria-pressed",
        String(enabled)
      );

      updateConnection();
    });

    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);

    /* =====================================================
       BUILT-IN BILINGUAL SAMPLE LESSONS
       These are not your complete lesson library.
       ===================================================== */

    const lessons = [
      {
        questions: [
          "what is downloading",
          "ማውረድ ምን ማለት ነው",
          "ማውረድ ምንድን ነው"
        ],
        am: "ማውረድ ማለት ፋይልን ከኢንተርኔት ወደ መሣሪያዎ ማስቀመጥ ማለት ነው።",
        en: "Downloading means saving a file from the internet to your device.",
        source: "Built-in sample lesson: Computer Basics"
      },
      {
        questions: [
          "what is email",
          "what is an email",
          "ኢሜይል ምንድን ነው",
          "ኢሜይል ምን ማለት ነው"
        ],
        am: "ኢሜይል በኢንተርኔት መልዕክት ለመላክና ለመቀበል የሚያገለግል መንገድ ነው።",
        en: "Email is a way to send and receive messages over the internet.",
        source: "Built-in sample lesson: Internet and Email"
      },
      {
        questions: [
          "what is a job interview",
          "የሥራ ቃለ መጠይቅ ምንድን ነው",
          "ቃለ መጠይቅ ምንድን ነው"
        ],
        am: "የሥራ ቃለ መጠይቅ አሠሪው ስለ ክህሎትዎና ልምድዎ የሚጠይቅበት ውይይት ነው።",
        en: "A job interview is a conversation in which an employer asks about your skills and experience.",
        source: "Built-in sample lesson: Jobs and Interviews"
      }
    ];

    function normalizeQuestion(text) {
      return String(text)
        .toLowerCase()
        .replace(/[?፧።.!]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    function localAnswer(text) {
      const normalized = normalizeQuestion(text);

      return lessons.find(item =>
        item.questions.some(
          sample => normalizeQuestion(sample) === normalized
        )
      ) || null;
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
            `${method} ${path}`,
            response.status,
            raw.slice(0, 1500)
          );

          const error = new Error(
            `Server returned HTTP ${response.status}.`
          );

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
       BILINGUAL ANSWER DISPLAY
       ===================================================== */

    function extractLanguage(text, lang) {
      return String(text)
        .split(/\n\s*(?:Source\s*:|Source\s*\/|ምንጭ\s*:|📚)/i)[0]
        .split(/\n+/)
        .filter(line => lang === "am"
          ? ETHIOPIC.test(line)
          : /[A-Za-z]/.test(line) && !ETHIOPIC.test(line))
        .join("\n")
        .trim();
    }

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

      const am = record.am || "የአማርኛ ትርጉም ከአገልጋዩ አልተመለሰም።";
      const en = record.en || "The server did not return an English translation.";

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

    async function getAnswer() {
      stopReading();
      stopMicrophone();

      const text = question.value.trim();
      const firstLanguage = detectLanguage(text);
      const version = ++requestVersion;

      requestController?.abort();
      requestController = null;
      busy($("getAnswerBtn"), false);

      if (!text) {
        status(
          "እባክዎ ጥያቄ ይጻፉ።",
          "Please type a question first.",
          "warn"
        );

        question.focus({ preventScroll: true });
        return;
      }

      if (text.length > 6000) {
        status(
          "ጥያቄዎን እባክዎ ያሳጥሩ።",
          "Please shorten the question to 6,000 characters or fewer.",
          "warn"
        );
        return;
      }

      const local = localAnswer(text);

      if (local) {
        displayAnswer(local, firstLanguage);

        status(
          "መልሱ ከተካተተው የትምህርት ምሳሌ ተገኝቷል።",
          "Answer found in the built-in sample lesson.",
          "ok"
        );

        return;
      }

      currentAnswer = null;

      answer.value = firstLanguage === "am"
        ? "መልስ ከአገልጋዩ እየተጠየቀ ነው...\n\nRequesting an answer..."
        : "Requesting an answer...\n\nመልስ ከአገልጋዩ እየተጠየቀ ነው...";

      answer.scrollTop = 0;
      busy($("getAnswerBtn"), true);

      const controller = new AbortController();
      requestController = controller;

      const payload = {
        chatId,
        question: text,
        language: firstLanguage,
        responseLanguages: ["am", "en"]
      };

      const lessonId = $("lessonSelect")?.value;
      if (lessonId) payload.lessonId = lessonId;

      try {
        const data = await api(CONFIG.answerPath, {
          method: "POST",
          body: payload,
          signal: controller.signal
        });

        if (version !== requestVersion) return;

        const record = normalizeAnswer(data);
        displayAnswer(record, firstLanguage);

        status(
          "መልሱ ዝግጁ ነው።",
          "Your answer is ready.",
          record.am && record.en ? "ok" : "warn"
        );
      } catch (error) {
        if (version !== requestVersion) return;

        let am;
        let en;

        if (error.status === 404) {
          am =
            "የመልስ አገልጋዩ መንገድ አልተገኘም። የRailway API አድራሻና መንገድ ማስተካከል ያስፈልጋል።";

          en =
            "The answer API route was not found. Verify the Railway URL and the actual backend answer route.";
        } else {
          am =
            "ከአገልጋዩ መልስ ማግኘት አልተቻለም። እንደገና ይሞክሩ ወይም እርዳታ ይጠይቁ።";

          en =
            "The answer service could not complete the request. Try again or use I Need Help.";
        }

        displayAnswer({ am, en, source: "" }, firstLanguage);

        status(
          "የአገልጋዩን ዝርዝር በConsole ይመልከቱ።",
          "See the console and Railway logs for details.",
          "warn"
        );

        console.error("Answer request failed:", error);
      } finally {
        if (version === requestVersion) {
          requestController = null;
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
       ONE READING CONTROLLER
       ===================================================== */

    function stopReading() {
      speechVersion++;
      readingLanguage = null;

      speechController?.abort();
      speechController = null;

      const cancel = cancelSpeech;
      cancelSpeech = null;
      cancel?.();

      if (activeUtterance) {
        activeUtterance.onend = null;
        activeUtterance.onerror = null;
        activeUtterance = null;
      }

      try {
        window.speechSynthesis?.cancel();
      } catch {}

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

      function score(voice) {
        let result = voice.localService ? 2 : 0;

        preferred.forEach((name, index) => {
          if (voice.name.toLowerCase().includes(name.toLowerCase())) {
            result += 100 - index;
          }
        });

        return result;
      }

      return voices
        .filter(voice => {
          const code = voice.lang.toLowerCase().replace(/_/g, "-");
          return code === lang || code.startsWith(`${lang}-`);
        })
        .sort((a, b) => score(b) - score(a))[0] || null;
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

          if (cancelSpeech === cancel) cancelSpeech = null;

          resolve(voices);
        }

        function cancel() {
          finish([]);
        }

        function check() {
          if (run !== speechVersion) {
            finish([]);
            return;
          }

          const voices = synth.getVoices();

          if (chooseVoice(voices, lang)) finish(voices);
        }

        cancelSpeech = cancel;
        synth.addEventListener("voiceschanged", check);

        timer = setTimeout(() => {
          finish(run === speechVersion ? synth.getVoices() : []);
        }, 1500);

        check();
      });
    }

    function readingText(lang) {
      if (currentAnswer) return currentAnswer[lang] || "";

      return extractLanguage(answer.value, lang)
        .replace(/^(English|አማርኛ)\s*$/gm, "")
        .trim();
    }

    function makeChunks(text) {
      const sentences = text
        .replace(/https?:\/\/\S+/g, "")
        .replace(/[*#`]/g, "")
        .match(/[^.!?።፧\n]+[.!?።፧]?/g) || [];

      const chunks = [];

      for (const sentence of sentences) {
        let chunk = "";

        for (const word of sentence.trim().split(/\s+/)) {
          if (chunk && `${chunk} ${word}`.length > 180) {
            chunks.push(chunk);
            chunk = "";
          }

          chunk = chunk ? `${chunk} ${word}` : word;
        }

        if (chunk) chunks.push(chunk);
      }

      return chunks;
    }

    function speakChunk(text, voice, lang, run) {
      return new Promise((resolve, reject) => {
        if (run !== speechVersion) {
          resolve(false);
          return;
        }

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
          if (cancelSpeech === cancel) cancelSpeech = null;

          error ? reject(error) : resolve(completed);
        }

        function cancel() {
          finish(null, false);
        }

        const timer = setTimeout(() => {
          finish(new Error("Reading timed out."));

          try {
            window.speechSynthesis.cancel();
          } catch {}
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
        cancelSpeech = cancel;

        try {
          window.speechSynthesis.speak(utterance);
        } catch (error) {
          finish(error);
        }
      });
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
        ) {
          throw new Error("Speech endpoint did not return audio.");
        }

        const blob = await response.blob();

        if (run !== speechVersion) return;

        objectURL = URL.createObjectURL(blob);

        const player = new Audio(objectURL);
        player.volume = 0.8;
        activeAudio = player;

        await new Promise((resolve, reject) => {
          let done = false;

          function finish(error) {
            if (done) return;
            done = true;

            clearTimeout(playTimer);
            player.onended = null;
            player.onerror = null;

            if (cancelSpeech === cancel) cancelSpeech = null;

            error ? reject(error) : resolve();
          }

          function cancel() {
            player.pause();
            finish();
          }

          const playTimer = setTimeout(() => {
            player.pause();
            finish(new Error("Audio timed out."));
          }, 300000);

          cancelSpeech = cancel;
          player.onended = () => finish();
          player.onerror = () => finish(new Error("Audio failed."));

          player.play().catch(finish);
        });
      } finally {
        clearTimeout(timer);

        if (speechController === controller) speechController = null;
        if (objectURL) URL.revokeObjectURL(objectURL);
        if (run === speechVersion) activeAudio = null;
      }
    }

    async function readAloud(lang) {
      const same = readingLanguage === lang;

      stopReading();

      if (same) return;

      stopMicrophone();

      const text = readingText(lang).trim();

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

            const completed =
              await speakChunk(chunk, voice, lang, run);

            if (!completed || run !== speechVersion) return;
          }
        } else if (CONFIG.speechPath) {
          await serverSpeech(text, lang, run);
        } else {
          status(
            "በዚህ መሣሪያ ለተመረጠው ቋንቋ የንባብ ድምፅ የለም።",
            `No ${lang === "am" ? "Amharic" : "English"} voice is available. A server speech service is needed for this device.`,
            "warn"
          );
        }
      } catch (error) {
        if (run === speechVersion) {
          status(
            "የድምፅ ንባቡ አልተሳካም።",
            "Reading failed. Check the device voice or speech service.",
            "warn"
          );

          console.warn("Reading:", error.message);
        }
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
       MICROPHONE + SOFT BEEPS
       ===================================================== */

    function unlockAudio() {
      const Context =
        window.AudioContext || window.webkitAudioContext;

      if (!Context) return;

      try {
        audioContext ||= new Context();
        audioContext.resume().catch(() => {});
      } catch {}
    }

    function beep(startTone) {
      if (audioContext?.state !== "running") return;

      try {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const now = audioContext.currentTime;

        oscillator.type = "sine";

        oscillator.frequency.setValueAtTime(
          startTone ? 620 : 820,
          now
        );

        oscillator.frequency.exponentialRampToValueAtTime(
          startTone ? 820 : 580,
          now + 0.16
        );

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.045, now + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };

        oscillator.start(now);
        oscillator.stop(now + 0.2);
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

      try {
        session.recognizer.abort();
      } catch {}

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
        finished: false
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
          .join(" ")
          .trim();

        question.value = [
          question.value.trim(),
          text
        ].filter(Boolean).join(" ");

        status(
          "ጥያቄዎ ተጽፏል። መልስ አግኝ ይጫኑ።",
          "Your words were added. Press Get Answer.",
          "ok"
        );
      };

      recognizer.onerror = event => {
        if (
          microphone === session &&
          event.error !== "aborted"
        ) {
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
       CLEAR / COPY
       ===================================================== */

    on("clearBtn", () => {
      requestVersion++;
      requestController?.abort();
      requestController = null;

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
        copied
          ? "ጥያቄው ተቀድቷል።"
          : "ጥያቄው ለእርዳታ ተዘጋጅቷል፣ ግን ወደ ቅንጭብ ሰሌዳ አልተቀዳም።",
        copied
          ? "Question copied."
          : "Question saved for Help, but clipboard access was unavailable.",
        copied ? "ok" : "warn"
      );
    });

    /* =====================================================
       TELEGRAM HANDOFF
       ===================================================== */

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
        "If Telegram does not show the draft, copy the message below, paste it into the bot, and press Send.";

      const draft = document.createElement("textarea");
      draft.value = text;
      draft.readOnly = true;
      draft.rows = 4;
      draft.setAttribute("aria-label", "Telegram message");

      const copy = document.createElement("button");
      copy.type = "button";
      copy.textContent = "Copy message";

      copy.addEventListener("click", async () => {
        if (await copyText(text)) {
          copy.textContent = "Copied";
        } else {
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

      panel.append(
        note,
        draft,
        copy,
        document.createTextNode(" "),
        link
      );

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

      status(
        "መልዕክቱን በTelegram ያረጋግጡና Send ይጫኑ።",
        "Review the Telegram draft and press Send."
      );
    });

    /* =====================================================
       JOB ALERT / INTERVIEW FORMS
       ===================================================== */

    function formStatus(form) {
      if (!form) return null;

      const node = document.createElement("p");
      node.className = "voice-status";
      node.setAttribute("role", "status");

      form.insertAdjacentElement("afterend", node);

      return node;
    }

    function clearForm(form) {
      form.reset();

      form.querySelectorAll("input, textarea, select")
        .forEach(field => {
          if (field instanceof HTMLSelectElement) {
            field.selectedIndex = 0;
          } else if (
            field.type === "checkbox" ||
            field.type === "radio"
          ) {
            field.checked = false;
          } else if (
            !["hidden", "submit", "button"].includes(field.type)
          ) {
            field.value = "";
          }
        });
    }

    const value = id => $(id)?.value.trim() || "";

    const validPhone = phone =>
      !phone || /^[+\d\s()-]{7,25}$/.test(phone);

    async function submitForm({
      form,
      button,
      path,
      payload,
      message,
      target
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
          "Server submission was not confirmed. Use the Telegram message below.",
          "warn",
          target
        );
      } finally {
        delete form.dataset.busy;
        busy(button, false);
      }
    }

    const jobForm = $("jobAlertForm");
    const jobNotice = formStatus(jobForm);

    jobForm?.addEventListener("submit", event => {
      event.preventDefault();

      const phone = value("jobPhone");
      const telegram = value("jobTelegram");
      const area = value("jobArea");

      if ((!phone && !telegram) || !area || !validPhone(phone)) {
        status(
          "ስልክ ወይም Telegram ስም ያስገቡ፣ የሥራ መስክም ይምረጡ።",
          "Enter a valid contact and select a job area.",
          "warn",
          jobNotice
        );
        return;
      }

      submitForm({
        form: jobForm,
        button: $("jobAlertBtn"),
        path: "/api/job-alert",
        target: jobNotice,
        payload: { phone, telegram, area, notify: true },
        message: [
          "Job alert request",
          `Phone: ${phone || "Not provided"}`,
          `Telegram: ${telegram || "Not provided"}`,
          `Job area: ${area}`
        ].join("\n")
      });
    });

    const interviewForm = $("accommodationForm");
    const interviewNotice = formStatus(interviewForm);

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
          "warn",
          interviewNotice
        );
        return;
      }

      submitForm({
        form: interviewForm,
        button: $("accommodationBtn"),
        path: "/api/accommodation",
        target: interviewNotice,
        payload: {
          name,
          phone,
          type,
          details,
          status: "requested"
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

    /* =====================================================
       MEETING LINK / DOWNLOAD
       ===================================================== */

    on("screenShareBtn", () => {
      const input = window.prompt(
        "Enter an HTTPS meeting link. This does not automatically share your screen."
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
      const content = [
        "Learning and Employment / ትምህርት እና ሥራ",
        `Question:\n${question.value}`,
        `Answer:\n${answer.value}`
      ].join("\n\n");

      const url = URL.createObjectURL(
        new Blob(["\uFEFF", content], {
          type: "text/plain;charset=utf-8"
        })
      );

      const link = document.createElement("a");

      link.href = url;
      link.download = "learning-and-employment.txt";

      document.body.append(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });

    /* =====================================================
       TEACHER STATISTICS
       ===================================================== */

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
       NON-DESTRUCTIVE DIAGNOSTICS
       ===================================================== */

    window.testWebsite = async () => {
      const results = [];

      [
        "question",
        "answer",
        "getAnswerBtn",
        "clearBtn",
        "copyBtn",
        "speakAmharicBtn",
        "speakEnglishBtn",
        "jobAlertForm",
        "accommodationForm"
      ].forEach(id => {
        const count =
          document.querySelectorAll(`[id="${id}"]`).length;

        results.push({
          test: `Unique #${id}`,
          passed: count === 1,
          details: `Found ${count}`
        });
      });

      const voices = window.speechSynthesis?.getVoices() || [];

      results.push({
        test: "Amharic built-in answer",
        passed: Boolean(localAnswer("ማውረድ ምን ማለት ነው?")),
        details: ""
      });

      results.push({
        test: "Amharic device voice",
        passed: Boolean(chooseVoice(voices, "am")),
        details: "If unavailable, configure a real server speech route."
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
          details: "Does not prove the answer route or Groq works."
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
      requestController?.abort();
      stopReading();
      stopMicrophone();
    });

    console.info(
      "Bilingual learning app initialized. Run testWebsite() for diagnostics."
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();