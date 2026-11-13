"use strict";

(() => {
  const APP_KEY = "__learningEmploymentFinal";

  if (window[APP_KEY]) return;
  window[APP_KEY] = true;

  function start() {
    /* =====================================================
       CONFIGURATION
       ===================================================== */

    const API_BASE =
      "https://learning-assistant-bot-production.up.railway.app";

    const TELEGRAM_URL = "https://t.me/EbaMengistuBot";

    /*
     * Set to "/api/tts" ONLY after your backend implements it.
     *
     * Request:
     * POST JSON { text, language: "am-ET" | "en-US" }
     *
     * Response:
     * Audio bytes with Content-Type: audio/mpeg, audio/wav, etc.
     */
    const TTS_PATH = "";

    const SETTINGS_KEY = "learning_final_settings";

    const $ = id => document.getElementById(id);

    const question = $("question");
    const answer = $("answer");

    if (!question || !answer) {
      console.error("Missing #question or #answer.");
      return;
    }

    const ETHIOPIC =
      /[\u1200-\u137f\u1380-\u139f\u2d80-\u2ddf]/;

    function readSettings() {
      try {
        const value = JSON.parse(
          localStorage.getItem(SETTINGS_KEY) || "{}"
        );

        return value && typeof value === "object" ? value : {};
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

    let answerRecord = null;
    let copiedQuestion = "";
    let answerVersion = 0;
    let answerRequest = null;

    let readingLanguage = null;
    let readingVersion = 0;
    let readingCancel = null;
    let readingFetch = null;
    let activeUtterance = null;
    let activeAudio = null;

    let microphone = null;
    let audioContext = null;

    const on = (id, callback) => {
      $(id)?.addEventListener("click", callback);
    };

    function saveSetting(key, value) {
      settings[key] = value;

      try {
        localStorage.setItem(
          SETTINGS_KEY,
          JSON.stringify(settings)
        );
      } catch {
        // Storage is optional.
      }
    }

    saveSetting("chatId", chatId);

    function status(am, en, type = "info", target = $("voiceStatus")) {
      const text = language === "am" ? am : en;

      if (target) {
        target.textContent = text;
        target.className = `voice-status ${type}`;
      }

      const live = $("liveRegion");
      if (live) live.textContent = text;
    }

    function detectLanguage(text) {
      if (ETHIOPIC.test(text)) return "am";
      if (/[A-Za-z]/.test(text)) return "en";
      return language;
    }

    function busy(button, enabled) {
      if (!button) return;

      button.disabled = enabled;

      if (enabled) button.setAttribute("aria-busy", "true");
      else button.removeAttribute("aria-busy");
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
       LANGUAGE / DISPLAY
       ===================================================== */

    const labels = {
      am: {
        question: "ጥያቄዎን ይጻፉ",
        answer: "መልስ",
        placeholder: "ስለ ትምህርቱ ጥያቄ ይጻፉ...",
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
        placeholder: "Ask a question about your lesson...",
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
        ["speakAmharicBtn", readingLanguage === "am", t.readAm],
        ["speakEnglishBtn", readingLanguage === "en", t.readEn],
        ["voiceAmharicBtn", microphone?.lang === "am", t.micAm],
        ["voiceEnglishBtn", microphone?.lang === "en", t.micEn]
      ].forEach(([id, enabled, normal]) => {
        const button = $(id);
        if (!button) return;

        const isMicrophone = id.startsWith("voice");

        button.textContent = enabled
          ? isMicrophone ? t.listening : t.stop
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

      const questionLabel =
        document.querySelector('label[for="question"]');

      const answerLabel =
        document.querySelector('label[for="answer"]');

      if (questionLabel) questionLabel.textContent = t.question;
      if (answerLabel) answerLabel.textContent = t.answer;

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
       BACKEND REQUESTS
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
        const response = await fetch(`${API_BASE}${path}`, {
          method,
          headers: body
            ? { "Content-Type": "application/json" }
            : undefined,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error(`Server HTTP ${response.status}`);
        }

        const raw = await response.text();
        const data = raw.trim() ? JSON.parse(raw) : {};

        if (data.ok === false || data.success === false) {
          throw new Error("Server rejected the request.");
        }

        return data;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
      }
    }

    /* =====================================================
       ANSWERS — YOUR API ONLY
       No FAQ substitution, Wikipedia, or stale answer cache.
       ===================================================== */

    function normalizeAnswer(data) {
      const structured =
        data.answer && typeof data.answer === "object"
          ? data.answer
          : data;

      const am = String(
        structured.answerAm || structured.am || ""
      ).trim();

      const en = String(
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

      if (!am && !en && !raw.trim()) {
        throw new Error("The API returned no answer text.");
      }

      const source = data.source || data.citation || "";

      return {
        am,
        en,
        raw: raw.trim(),
        source: typeof source === "string" ? source : ""
      };
    }

    function extractLanguage(text, lang) {
      const body = String(text)
        .split(/\n\s*(?:Source\s*:|Source\s*\/|ምንጭ\s*:|📚)/i)[0];

      return body
        .split(/\n+/)
        .filter(line => lang === "am"
          ? ETHIOPIC.test(line)
          : /[A-Za-z]/.test(line) && !ETHIOPIC.test(line))
        .join("\n")
        .trim();
    }

    function showRecord(record, firstLanguage) {
      answerRecord = record;

      let am = record.am;
      let en = record.en;

      if (!am && !en && record.raw) {
        am = extractLanguage(record.raw, "am");
        en = extractLanguage(record.raw, "en");
      }

      const parts = firstLanguage === "am"
        ? [am, en]
        : [en, am];

      let text = parts.filter(Boolean).join("\n\n");

      if (!text) text = record.raw;

      if (record.source) {
        text += `\n\nSource / ምንጭ: ${record.source}`;
      }

      const previousQuestionScroll = question.scrollTop;

      answer.value = text;
      answer.style.removeProperty("height");
      answer.scrollTop = 0;
      answer.scrollLeft = 0;

      question.scrollTop = previousQuestionScroll;

      status("መልሱ ዝግጁ ነው።", "Your answer is ready.", "ok");
    }

    async function getAnswer() {
      stopReading();
      stopMicrophone();

      const text = question.value.trim();
      const firstLanguage = detectLanguage(text);
      const version = ++answerVersion;

      answerRequest?.abort();
      answerRequest = null;
      busy($("getAnswerBtn"), false);

      if (!text) {
        status(
          "እባክዎ መጀመሪያ ጥያቄ ይጻፉ።",
          "Please type a question first.",
          "warn"
        );

        question.focus({ preventScroll: true });
        return;
      }

      if (text.length > 6000) {
        status(
          "ጥያቄዎን እባክዎ ያሳጥሩ።",
          "Please shorten your question to 6,000 characters or fewer.",
          "warn"
        );
        return;
      }

      answerRecord = null;

      answer.value = firstLanguage === "am"
        ? "ከትምህርት መረጃው መልስ እየተፈለገ ነው..."
        : "Requesting an answer from your lesson API...";

      answer.scrollTop = 0;
      busy($("getAnswerBtn"), true);

      const controller = new AbortController();
      answerRequest = controller;

      /*
       * Optional lesson selector support.
       * Existing HTML has no #lessonSelect; in that case lessonId
       * is omitted and the backend must choose the lesson corpus.
       */
      const lessonId = $("lessonSelect")?.value || "";

      const payload = {
        chatId,
        question: text,
        language: firstLanguage,
        responseLanguages: [
          firstLanguage,
          firstLanguage === "am" ? "en" : "am"
        ]
      };

      if (lessonId) payload.lessonId = lessonId;

      try {
        const data = await api("/api/ask", {
          method: "POST",
          body: payload,
          signal: controller.signal
        });

        if (version !== answerVersion) return;

        const record = normalizeAnswer(data);
        showRecord(record, firstLanguage);

        if (!record.am || !record.en) {
          status(
            "አገልጋዩ በሁለቱም ቋንቋዎች የተለየ መልስ አልሰጠም።",
            "The API did not return separate Amharic and English answer fields.",
            "warn"
          );
        }
      } catch (error) {
        if (version !== answerVersion) return;

        answer.value = firstLanguage === "am"
          ? "ከአገልጋዩ መልስ ማግኘት አልተቻለም። እንደገና ይሞክሩ ወይም እርዳታ ይጠይቁ።"
          : "Your answer API did not respond successfully. Try again or use I Need Help.";

        status(
          "የመልስ አገልጋዩን ያረጋግጡ።",
          "Check the Railway answer route and server logs.",
          "warn"
        );

        console.warn("Answer API:", error.message);
      } finally {
        if (version === answerVersion) {
          answerRequest = null;
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
       SINGLE READING CONTROLLER
       ===================================================== */

    const voicePreferences = {
      am: ["Ameha"],
      en: ["David", "Mark", "Guy", "Ryan", "George", "Daniel"]
    };

    function stopReading() {
      readingVersion++;
      readingLanguage = null;

      readingFetch?.abort();
      readingFetch = null;

      const cancel = readingCancel;
      readingCancel = null;
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

    function waitForVoices(run) {
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

          if (readingCancel === cancel) readingCancel = null;
          resolve(voices);
        }

        function cancel() {
          finish([]);
        }

        function check() {
          if (run !== readingVersion) {
            finish([]);
            return;
          }

          const voices = synth.getVoices();

          if (
            voices.some(v => /^am(?:-|_|$)/i.test(v.lang)) &&
            voices.some(v => /^en(?:-|_|$)/i.test(v.lang))
          ) finish(voices);
        }

        readingCancel = cancel;
        synth.addEventListener("voiceschanged", check);

        timer = setTimeout(
          () => finish(
            run === readingVersion ? synth.getVoices() : []
          ),
          1200
        );

        check();
      });
    }

    function chooseVoice(voices, lang) {
      const score = voice => {
        let value = voice.localService ? 2 : 0;

        voicePreferences[lang].forEach((name, index) => {
          if (voice.name.toLowerCase().includes(name.toLowerCase())) {
            value += 100 - index;
          }
        });

        return value;
      };

      return voices
        .filter(voice => {
          const code = voice.lang.toLowerCase().replace(/_/g, "-");
          return code === lang || code.startsWith(`${lang}-`);
        })
        .sort((a, b) => score(b) - score(a))[0] || null;
    }

    function textForReading(lang) {
      /*
       * Buttons select the reading language.
       * The interface toggle does not affect this choice.
       */
      if (answerRecord?.[lang]?.trim()) {
        return answerRecord[lang].trim();
      }

      return extractLanguage(answer.value, lang);
    }

    function chunks(text) {
      const output = [];
      const sentences =
        text
          .replace(/https?:\/\/\S+/g, "")
          .replace(/[*#`]/g, "")
          .match(/[^.!?።፧\n]+[.!?።፧]?/g) || [];

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
        if (run !== readingVersion) {
          resolve(false);
          return;
        }

        const utterance = new SpeechSynthesisUtterance(text);

        utterance.voice = voice;
        utterance.lang = lang === "am" ? "am-ET" : "en-US";
        utterance.rate = lang === "am" ? 0.85 : 0.88;
        utterance.pitch = 0.94;
        utterance.volume = 0.8;

        let finished = false;

        function finish(error, completed = true) {
          if (finished) return;
          finished = true;

          clearTimeout(timer);
          utterance.onend = null;
          utterance.onerror = null;

          if (activeUtterance === utterance) {
            activeUtterance = null;
          }

          if (readingCancel === cancel) readingCancel = null;

          error ? reject(error) : resolve(completed);
        }

        function cancel() {
          finish(null, false);
        }

        const timer = setTimeout(() => {
          finish(new Error("Reading timed out."));
          window.speechSynthesis.cancel();
        }, 60000);

        utterance.onend = () => finish(null, true);

        utterance.onerror = event => {
          if (
            run !== readingVersion ||
            ["canceled", "interrupted"].includes(event.error)
          ) finish(null, false);
          else finish(new Error(event.error || "Reading failed."));
        };

        activeUtterance = utterance;
        readingCancel = cancel;

        try {
          window.speechSynthesis.speak(utterance);
        } catch (error) {
          finish(error);
        }
      });
    }

    async function serverReading(text, lang, run) {
      const controller = new AbortController();
      readingFetch = controller;

      let objectUrl;
      const timer = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch(`${API_BASE}${TTS_PATH}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            language: lang === "am" ? "am-ET" : "en-US"
          }),
          signal: controller.signal
        });

        if (
          !response.ok ||
          !response.headers.get("Content-Type")
            ?.toLowerCase().startsWith("audio/")
        ) {
          throw new Error("The speech endpoint did not return audio.");
        }

        const blob = await response.blob();

        if (run !== readingVersion) return;

        objectUrl = URL.createObjectURL(blob);

        const player = new Audio(objectUrl);
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

            if (readingCancel === cancel) readingCancel = null;

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

          readingCancel = cancel;
          player.onended = () => finish();
          player.onerror = () => finish(new Error("Audio failed."));

          player.play().catch(finish);
        });
      } finally {
        clearTimeout(timer);

        if (readingFetch === controller) readingFetch = null;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        if (run === readingVersion) activeAudio = null;
      }
    }

    async function readAloud(lang) {
      const same = readingLanguage === lang;

      stopReading();
      if (same) return;

      stopMicrophone();

      const text = textForReading(lang);

      if (!text) {
        status(
          "በተመረጠው ቋንቋ የመልስ ጽሑፍ የለም።",
          `There is no ${lang === "am" ? "Amharic" : "English"} answer text.`,
          "warn"
        );
        return;
      }

      const run = readingVersion;
      readingLanguage = lang;
      updateMediaButtons();

      try {
        const voices = await waitForVoices(run);
        if (run !== readingVersion) return;

        const voice = chooseVoice(voices, lang);

        if (voice) {
          for (const chunk of chunks(text)) {
            if (run !== readingVersion) return;

            const completed =
              await speakChunk(chunk, voice, lang, run);

            if (!completed || run !== readingVersion) return;
          }
        } else if (TTS_PATH) {
          await serverReading(text, lang, run);
        } else {
          status(
            "በዚህ መሣሪያ ለተመረጠው ቋንቋ ድምፅ አልተገኘም። የአገልጋይ ንባብ አገልግሎት ያስፈልጋል።",
            `No ${lang === "am" ? "Amharic" : "English"} voice is available. Configure a server speech endpoint for this device.`,
            "warn"
          );
        }
      } catch (error) {
        if (run === readingVersion) {
          status(
            "የድምፅ ንባቡ አልተሳካም።",
            "Reading failed. Check the device voice or speech server.",
            "warn"
          );

          console.warn("Reading:", error.message);
        }
      } finally {
        if (run === readingVersion) {
          readingLanguage = null;
          updateMediaButtons();
        }
      }
    }

    on("speakAmharicBtn", () => readAloud("am"));
    on("speakEnglishBtn", () => readAloud("en"));

    /* =====================================================
       MICROPHONE + START / END BEEPS
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
          "የድምፅ ግብዓት አይገኝም። ጥያቄዎን ይጻፉ።",
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

        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join(" ")
          .trim();

        question.value = [
          question.value.trim(),
          transcript
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
      answerVersion++;
      answerRequest?.abort();
      answerRequest = null;

      question.value = "";
      answer.value = "";

      question.scrollTop = 0;
      answer.scrollTop = 0;
      answer.style.removeProperty("height");

      answerRecord = null;
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
       TELEGRAM HANDOFF + VISIBLE MESSAGE FALLBACK
       ===================================================== */

    function telegramHandoff(text, container) {
      const url = new URL(TELEGRAM_URL);
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
        "የTelegram መልዕክቱን ያረጋግጡና Send ይጫኑ።",
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

    async function submitSupport({
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

      submitSupport({
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

      submitSupport({
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
      const text = [
        "Learning and Employment / ትምህርት እና ሥራ",
        `Question:\n${question.value}`,
        `Answer:\n${answer.value}`
      ].join("\n\n");

      const url = URL.createObjectURL(
        new Blob(["\uFEFF", text], {
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
       TEACHER VIEW
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
       DIAGNOSTICS — NO QUESTIONS OR FORMS SENT
       ===================================================== */

    window.testWebsite = async () => {
      const results = [];

      [
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
        test: "Amharic device voice",
        passed: Boolean(chooseVoice(voices, "am")),
        details: "If false, server TTS may be required."
      });

      results.push({
        test: "English device voice",
        passed: Boolean(chooseVoice(voices, "en")),
        details: ""
      });

      results.push({
        test: "Server TTS configured in frontend",
        passed: Boolean(TTS_PATH),
        details: "Configuration does not prove the endpoint works."
      });

      try {
        await api("/health", { timeout: 8000 });

        results.push({
          test: "Server health",
          passed: true,
          details: "Does not verify Groq or lesson grounding."
        });
      } catch {
        results.push({
          test: "Server health",
          passed: false,
          details: "Check network, CORS, and backend logs."
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
      answerVersion++;
      answerRequest?.abort();
      stopReading();
      stopMicrophone();
    });

    console.info(
      "Learning app initialized. Answers use /api/ask only."
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();