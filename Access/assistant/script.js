const questionInput = document.getElementById("question");
const answerBox = document.getElementById("answer");
const getAnswerBtn = document.getElementById("getAnswerBtn");
const speakEnglishBtn = document.getElementById("speakEnglishBtn");
const speakAmharicBtn = document.getElementById("speakAmharicBtn");
const contrastBtn = document.getElementById("contrastBtn");
const clearBtn = document.getElementById("clearBtn");
const copyBtn = document.getElementById("copyBtn");
const humanHelpBtn = document.getElementById("humanHelpBtn");
const fontSmall = document.getElementById("fontSmall");
const fontNormal = document.getElementById("fontNormal");
const fontLarge = document.getElementById("fontLarge");
const voiceAmharicBtn = document.getElementById("voiceAmharicBtn");
const voiceEnglishBtn = document.getElementById("voiceEnglishBtn");
const langToggle = document.getElementById("langToggle");
const onlineStatus = document.getElementById("onlineStatus");
const liveRegion = document.getElementById("liveRegion");
const fullAnswerBtn = document.getElementById("fullAnswerBtn");
const fullAnswerText = document.getElementById("fullAnswerText");
const simpleModeBtn = document.getElementById("simpleModeBtn");


let currentFontSize = 18;
let currentLang = localStorage.getItem("appLanguage") || "am";
let simpleMode = localStorage.getItem("simpleMode") === "true";
let lastCourseLesson = null;


if (!["am", "en"].includes(currentLang)) {
  currentLang = "am";
}


const onlinePlayer = new Audio();
let stopRequested = false;


const translations = {
  en: {
    mainTitle: "Learning Assistant",
    subtitle: "Multilingual Learning Assistant",
    questionLabel: "Type your question",
    answerLabel: "Answer",
    answerPlaceholder: "Answer will appear here...",
    getAnswer: "Get Answer",
    speakAm: "Read Amharic",
    speakEn: "Read English",
    clear: "Clear",
    copy: "Copy",
    help: "Request Human Help",
    contrast: "High Contrast",
    placeholder: "Type in English...",
    voiceAm: "🎤 Amharic",
    voiceEn: "🎤 English",
    reading: "Reading...",
    listening: "Listening...",
    noQuestion: "Please type a question.\nእባክዎ ጥያቄ ይጻፉ።",
    thinking: "Thinking...",
    answerFailed:
      "Could not get answer. Try again.\nምላሽ ማግኘት አልተቻለም። እባክዎ እንደገና ይሞክሩ።",
    copied: "Copied ✓",
    copyFailed: "Copy failed. Please try again.",
    noAmharic: "No Amharic text found.",
    amharicOnly:
      "This button is for Amharic only.\nይህ ቁልፍ ለአማርኛ ብቻ ነው።",
    englishOnly:
      "This button is for English only.\nይህ ቁልፍ ለእንግሊዝኛ ብቻ ነው።",
    micUnsupported: "Voice input works in Chrome or Edge.",
    micFailed:
      "Voice input is not available for this language on this device. Please type your question.",
    micPermission: "Please allow microphone access.",
    online: "Online",
    offline: "Offline — basic help may still work",
    readAloudTitle: "About Read Aloud",
    readAloudText:
      "English voice works on most devices. Amharic voice may need an installed voice or internet connection.",
    textSize: "Text size: {size}px",
    languageChanged: "Language changed to English.",
    speechStopped: "Speech stopped.",
    helpOpened: "Telegram help opened.",
    fullAnswer: "Show Full Answer",
    simpleAnswer: "Show Simple Answer",
    askCourseQuestion: "First ask a question from the course."
  },


  am: {
    mainTitle: "የመማር ረዳት",
    subtitle: "ባለብዙ ቋንቋ የመማር ረዳት",
    questionLabel: "ጥያቄዎን ይጻፉ",
    answerLabel: "መልስ",
    answerPlaceholder: "መልስ እዚህ ይታያል...",
    getAnswer: "መልስ ያግኙ",
    speakAm: "አማርኛ አንብብ",
    speakEn: "እንግሊዝኛ አንብብ",
    clear: "አጽዳ",
    copy: "ቅዳ",
    help: "የሰው እርዳታ ይጠይቁ",
    contrast: "ከፍተኛ ንፅፅር",
    placeholder: "በአማርኛ ይጻፉ...",
    voiceAm: "🎤 አማርኛ",
    voiceEn: "🎤 እንግሊዝኛ",
    reading: "እየተነበበ ነው...",
    listening: "እያዳመጥኩ ነው...",
    noQuestion: "እባክዎ ጥያቄ ይጻፉ።\nPlease type a question.",
    thinking: "እየተመለሰ ነው...",
    answerFailed:
      "ምላሽ ማግኘት አልተቻለም። እባክዎ እንደገና ይሞክሩ።\nCould not get answer. Try again.",
    copied: "ተቀድቷል ✓",
    copyFailed: "መቅዳት አልተቻለም። እባክዎ እንደገና ይሞክሩ።",
    noAmharic: "የአማርኛ ጽሑፍ አልተገኘም።",
    amharicOnly:
      "ይህ ቁልፍ ለአማርኛ ብቻ ነው።\nThis button is for Amharic only.",
    englishOnly:
      "ይህ ቁልፍ ለእንግሊዝኛ ብቻ ነው።\nThis button is for English only.",
    micUnsupported: "የድምፅ ግብዓት Chrome ወይም Edge ላይ ይሰራል።",
    micFailed:
      "በዚህ መሣሪያ ላይ ለዚህ ቋንቋ የድምፅ ግብዓት አይሰራም። እባክዎ ጥያቄዎን ይጻፉ።",
    micPermission: "እባክዎ ለማይክሮፎኑ ፈቃድ ይስጡ።",
    online: "ኢንተርኔት አለ",
    offline: "ኢንተርኔት የለም — መሰረታዊ ድጋፍ ሊሰራ ይችላል",
    readAloudTitle: "ስለ ድምፅ ንባብ",
    readAloudText:
      "የእንግሊዝኛ ድምፅ በአብዛኞቹ መሣሪያዎች ይሰራል። የአማርኛ ድምፅ የተጫነ ድምፅ ወይም ኢንተርኔት ሊያስፈልግ ይችላል።",
    textSize: "የጽሑፍ መጠን፦ {size}px",
    languageChanged: "ቋንቋው ወደ እንግሊዝኛ ተቀይሯል።",
    speechStopped: "ድምፅ ቆሟል።",
    helpOpened: "የቴሌግራም ድጋፍ ተከፍቷል።",
    fullAnswer: "ሙሉ መልስ አሳይ",
    simpleAnswer: "ቀላል መልስ አሳይ",
    askCourseQuestion: "መጀመሪያ ከትምህርቱ ጥያቄ ይጠይቁ።"
  }
};


function getText(key) {
  return translations[currentLang][key] || translations.en[key];
}


function announce(message) {
  if (liveRegion) {
    liveRegion.textContent = message;
  }
}


function setLanguage(language) {
  if (!translations[language]) {
    language = "am";
  }


  currentLang = language;
  localStorage.setItem("appLanguage", language);


  const text = translations[language];


  document.getElementById("mainTitle").textContent = text.mainTitle;
  document.getElementById("subtitle").textContent = text.subtitle;
  document.getElementById("questionLabel").textContent = text.questionLabel;
  document.getElementById("answerLabel").textContent = text.answerLabel;


  questionInput.placeholder = text.placeholder;
  answerBox.placeholder = text.answerPlaceholder;


  getAnswerBtn.textContent = text.getAnswer;
  speakAmharicBtn.textContent = text.speakAm;
  speakEnglishBtn.textContent = text.speakEn;
  clearBtn.textContent = text.clear;
  copyBtn.textContent = text.copy;
  humanHelpBtn.textContent = text.help;
  contrastBtn.textContent = text.contrast;


  voiceAmharicBtn.textContent = text.voiceAm;
  voiceEnglishBtn.textContent = text.voiceEn;


  langToggle.textContent = language === "am" ? "አ" : "E";


  document.getElementById("readAloudTitle").textContent = text.readAloudTitle;
  document.getElementById("readAloudText").textContent = text.readAloudText;


  if (fullAnswerText) {
    fullAnswerText.textContent = simpleMode
      ? text.fullAnswer
      : text.simpleAnswer;
  } else if (fullAnswerBtn) {
    fullAnswerBtn.textContent = simpleMode
      ? text.fullAnswer
      : text.simpleAnswer;
  }


  if (simpleModeBtn) {
    simpleModeBtn.textContent = simpleMode
      ? "Simple Mode: ON"
      : "Simple Mode";


    simpleModeBtn.setAttribute(
      "aria-pressed",
      simpleMode ? "true" : "false"
    );
  }


  document.querySelectorAll(".suggest").forEach(button => {
    const textSpan = button.querySelector(".btn-text");


    if (!textSpan) {
      return;
    }


    textSpan.textContent = currentLang === "am"
      ? button.dataset.am
      : button.dataset.en;
  });


  questionInput.lang = language;
  document.documentElement.lang = language;
}


function setActiveButton(button) {
  const selectableButtons = [
    langToggle,
    voiceAmharicBtn,
    voiceEnglishBtn,
    contrastBtn
  ];


  if (!selectableButtons.includes(button)) {
    return;
  }


  selectableButtons.forEach(item => {
    item.classList.remove("active");
  });


  button.classList.add("active");
}


function getVoices() {
  return new Promise(resolve => {
    if (!("speechSynthesis" in window)) {
      resolve([]);
      return;
    }


    const voices = speechSynthesis.getVoices();


    if (voices.length) {
      resolve(voices);
      return;
    }


    const timeout = setTimeout(() => {
      resolve(speechSynthesis.getVoices());
    }, 1500);


    speechSynthesis.addEventListener(
      "voiceschanged",
      () => {
        clearTimeout(timeout);
        resolve(speechSynthesis.getVoices());
      },
      { once: true }
    );
  });
}


function playBeep() {
  try {
    const context = new (
      window.AudioContext || window.webkitAudioContext
    )();


    const oscillator = context.createOscillator();
    const gain = context.createGain();


    oscillator.type = "sine";
    oscillator.connect(gain);
    gain.connect(context.destination);


    oscillator.frequency.value = 620;
    gain.gain.setValueAtTime(0.05, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      context.currentTime + 0.25
    );


    oscillator.start();
    oscillator.stop(context.currentTime + 0.25);
  } catch (error) {}
}


function playAudioUrl(url) {
  return new Promise((resolve, reject) => {
    onlinePlayer.onended = resolve;
    onlinePlayer.onerror = () => reject(new Error("Audio failed"));


    onlinePlayer.src = url;
    onlinePlayer.play().catch(reject);
  });
}


function cleanTextForSpeech(text) {
  return text
    .replace(/^-{3,}\s*$/gm, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/`{1,3}/g, "")
    .replace(/^>\s?/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[#*_>`~|]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}


function splitForSpeech(text, maxLength = 180) {
  const parts = text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[።፤፥፣፡?!.,;:])\s*/);


  const chunks = [];
  let current = "";


  for (const part of parts) {
    if ((current + " " + part).trim().length <= maxLength) {
      current = (current + " " + part).trim();
      continue;
    }


    if (current) {
      chunks.push(current);
    }


    if (part.length <= maxLength) {
      current = part;
      continue;
    }


    current = "";


    for (const word of part.split(" ")) {
      if ((current + " " + word).trim().length > maxLength) {
        if (current) {
          chunks.push(current);
        }


        current = word;
      } else {
        current = (current + " " + word).trim();
      }
    }
  }


  if (current) {
    chunks.push(current);
  }


  return chunks.filter(Boolean);
}


async function speakOnline(text, language) {
  stopRequested = false;


  const urls = [
    chunk =>
      "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=" +
      language +
      "&q=" +
      encodeURIComponent(chunk),


    chunk =>
      "https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=" +
      language +
      "&q=" +
      encodeURIComponent(chunk)
  ];


  for (const chunk of splitForSpeech(text)) {
    if (stopRequested) {
      return;
    }


    let played = false;
    let lastError = null;


    for (const createUrl of urls) {
      try {
        await playAudioUrl(createUrl(chunk));
        played = true;
        break;
      } catch (error) {
        lastError = error;


        if (stopRequested) {
          return;
        }
      }
    }


    if (!played) {
      throw lastError || new Error("Online TTS failed");
    }
  }
}


function stopAllSpeech() {
  stopRequested = true;


  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
  }


  onlinePlayer.pause();
  onlinePlayer.removeAttribute("src");
  onlinePlayer.load();
}


getAnswerBtn.addEventListener("click", getAnswer);


speakEnglishBtn.addEventListener("click", speakEnglish);
speakAmharicBtn.addEventListener("click", speakAmharic);


clearBtn.addEventListener("click", clearAll);
copyBtn.addEventListener("click", copyAnswer);
humanHelpBtn.addEventListener("click", requestHelp);


langToggle.addEventListener("click", () => {
  setActiveButton(langToggle);
  setLanguage(currentLang === "am" ? "en" : "am");
  announce(getText("languageChanged"));
});


contrastBtn.addEventListener("click", () => {
  const enabled = document.body.classList.toggle("high-contrast");


  contrastBtn.setAttribute("aria-pressed", enabled);
  localStorage.setItem("highContrast", enabled);
  setActiveButton(contrastBtn);
});


voiceAmharicBtn.addEventListener("click", () => {
  setActiveButton(voiceAmharicBtn);
  startVoice("am-ET", voiceAmharicBtn);
});


voiceEnglishBtn.addEventListener("click", () => {
  setActiveButton(voiceEnglishBtn);
  startVoice("en-US", voiceEnglishBtn);
});


fontSmall.addEventListener("click", () => changeFontSize(-5));
fontNormal.addEventListener("click", () => changeFontSize(0, true));
fontLarge.addEventListener("click", () => changeFontSize(5));


if (fullAnswerBtn) {
  fullAnswerBtn.addEventListener("click", toggleFullAnswer);
}


if (simpleModeBtn) {
  simpleModeBtn.addEventListener("click", () => {
    simpleMode = !simpleMode;
    localStorage.setItem("simpleMode", simpleMode);


    simpleModeBtn.setAttribute(
      "aria-pressed",
      simpleMode ? "true" : "false"
    );


    simpleModeBtn.textContent = simpleMode
      ? "Simple Mode: ON"
      : "Simple Mode";


    if (lastCourseLesson) {
      const updatedAnswer = formatCourseAnswer(lastCourseLesson);


      answerBox.value = updatedAnswer;
      announce(updatedAnswer);
      autoResizeAnswer();
    }
  });
}


document.querySelectorAll(".suggest").forEach(button => {
  button.addEventListener("click", () => {
    const text = currentLang === "am"
      ? button.dataset.am
      : button.dataset.en;


    questionInput.value = text;
    questionInput.focus();
  });
});



function changeFontSize(change, reset = false) {
  currentFontSize = reset
    ? 18
    : Math.max(14, Math.min(30, currentFontSize + change));


  const size = currentFontSize + "px";


  if (answerBox) {
    answerBox.style.fontSize = size;
  }


  if (questionInput) {
    questionInput.style.fontSize = size;
  }


  autoResizeAnswer();
  announce(getText("textSize").replace("{size}", currentFontSize));
}


function autoResizeAnswer() {
  if (!answerBox) return;


  answerBox.style.height = "auto";
  answerBox.style.height = answerBox.scrollHeight + 10 + "px";
}


function showAnswer(text) {
  answerBox.value = text;
  announce(text);
  autoResizeAnswer();
}


let COURSE_DATA = { lessons: [] };
let courseLoadPromise = null;


function loadCourseData() {
  if (courseLoadPromise) {
    return courseLoadPromise;
  }


  courseLoadPromise = (async () => {
    const response = await fetch("course-data.json");


    if (!response.ok) {
      throw new Error("Course file HTTP error: " + response.status);
    }


    const data = await response.json();


    if (!Array.isArray(data.lessons)) {
      throw new Error("course-data.json must contain a lessons array.");
    }


    COURSE_DATA = data;
  })().catch(error => {
    courseLoadPromise = null;
    console.error("Course loading failed:", error);
    throw error;
  });


  return courseLoadPromise;
}


function normalizeCourseText(text) {
  return String(text)
    .toLowerCase()
    .replace(/[?؟!.።,،]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function findCourseAnswer(question) {
  const questionText = normalizeCourseText(question);
  let bestLesson = null;
  let bestScore = 0;


  COURSE_DATA.lessons.forEach(lesson => {
    let score = 0;


    const keywords = lesson.keywords || [];


    keywords.forEach(keyword => {
      const keywordText = normalizeCourseText(keyword);


      if (!keywordText) {
        return;
      }


      if (questionText.includes(keywordText)) {
        score += 2;
      }
    });


    const lessonTitle = normalizeCourseText(lesson.title || "");


    if (questionText.includes(lessonTitle)) {
      score += 3;
    }


    if (score > bestScore) {
      bestScore = score;
      bestLesson = lesson;
    }
  });


  return bestScore > 0 ? bestLesson : null;
}


function formatCourseAnswer(lesson) {
  const language = currentLang === "am" ? "am" : "en";


  const answer = simpleMode
    ? lesson.simple?.[language] || lesson.simple?.en
    : lesson.answer?.[language] || lesson.answer?.en;


  const source = lesson.source || {};


  const sourceTitle = [
    source.lesson || lesson.title,
    source.section
  ]
    .filter(Boolean)
    .join(" — ");


  return [
    answer,
    "",
    "📚 Source: " + sourceTitle,
    source.url ? "🔗 " + source.url : ""
  ]
    .filter(Boolean)
    .join("\n");
}


async function getAnswer() {
  const question = questionInput.value.trim();


  if (!question) {
    showAnswer("Please type a question.\nእባክዎ ጥያቄ ይጻፉ።");
    return;
  }


  stopAllSpeech();


  try {
    await loadCourseData();
  } catch (error) {
    console.warn("Course data could not load:", error);
  }


  const course = findCourseAnswer(question);


  if (course) {
    lastCourseLesson = course;


    const courseAnswer = formatCourseAnswer(course);


    showAnswer(courseAnswer);
    return;
  }


  const local = getLocalAnswer(question);


  if (local) {
    showAnswer(local);
    return;
  }


  const saved = getSavedAnswer(question);


  if (saved) {
    showAnswer(saved);
    return;
  }


  if (!isOnline()) {
    showAnswer(OFFLINE_MESSAGE);
    return;
  }


  showAnswer("🔎 እየፈለግሁ ነው... / Searching...");


  if (getAnswerBtn) {
    getAnswerBtn.disabled = true;
  }


  try {
    const online = await getOnlineAnswer(question);
    showAnswer(online);
  } catch (error) {
    showAnswer(OFFLINE_MESSAGE);
  } finally {
    if (getAnswerBtn) {
      getAnswerBtn.disabled = false;
    }
  }
}


function toggleFullAnswer() {
  if (!lastCourseLesson) {
    alert(getText("askCourseQuestion"));
    return;
  }


  simpleMode = !simpleMode;
  localStorage.setItem("simpleMode", simpleMode);


  if (simpleModeBtn) {
    simpleModeBtn.setAttribute(
      "aria-pressed",
      simpleMode ? "true" : "false"
    );


    simpleModeBtn.textContent = simpleMode
      ? "Simple Mode: ON"
      : "Simple Mode";
  }


  if (fullAnswerBtn) {
    fullAnswerBtn.setAttribute(
      "aria-pressed",
      simpleMode ? "false" : "true"
    );


    if (fullAnswerText) {
      fullAnswerText.textContent = simpleMode
        ? getText("fullAnswer")
        : getText("simpleAnswer");
    } else {
      fullAnswerBtn.textContent = simpleMode
        ? getText("fullAnswer")
        : getText("simpleAnswer");
    }
  }


  const updatedAnswer = formatCourseAnswer(lastCourseLesson);


  answerBox.value = updatedAnswer;
  announce(updatedAnswer);
  autoResizeAnswer();
}


async function speakEnglish() {
  const text = answerBox.value;


  if (!text) {
    return;
  }


  const originalLabel = speakEnglishBtn.textContent;


  speakEnglishBtn.textContent = getText("reading");
  stopAllSpeech();
  stopRequested = false;


  const amharicPosition = text.search(/[\u1200-\u137F]/);


  let englishText = amharicPosition > 5
    ? text.slice(0, amharicPosition)
    : text;


  englishText = cleanTextForSpeech(englishText);


  try {
    await speakOnline(englishText, "en");
  } catch (error) {
    console.warn("Online English voice failed:", error);


    if (!("speechSynthesis" in window)) {
      return;
    }


    const voices = await getVoices();


    const preferredNames = [
      "Samantha",
      "Karen",
      "Daniel",
      "Alex",
      "Google UK English Female",
      "Google UK English Male"
    ];


    const englishVoices = voices.filter(voice => {
      return voice.lang.toLowerCase().startsWith("en");
    });


    englishVoices.sort((first, second) => {
      const getScore = voice => {
        const index = preferredNames.findIndex(name => {
          return voice.name.includes(name);
        });


        return index === -1 ? 100 : index;
      };


      return getScore(first) - getScore(second);
    });


    const voice = englishVoices[0];


    if (!voice) {
      return;
    }


    const utterance = new SpeechSynthesisUtterance(englishText);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 0.85;
    utterance.pitch = 1;


    utterance.onend = () => {
      speakEnglishBtn.textContent = originalLabel;
    };


    speechSynthesis.speak(utterance);
    return;
  }


  speakEnglishBtn.textContent = originalLabel;
}


async function speakAmharic() {
  const text = answerBox.value;


  if (!text) {
    return;
  }


  const startPosition = text.search(/[\u1200-\u137F]/);


  if (startPosition === -1) {
    alert(getText("noAmharic"));
    return;
  }


  const originalLabel = speakAmharicBtn.textContent;


  speakAmharicBtn.textContent = getText("reading");
  stopAllSpeech();
  stopRequested = false;


  const amharicText = cleanTextForSpeech(
    text
      .slice(startPosition)
      .replace(/\n*📚.*$/s, "")
  );


  try {
    if ("speechSynthesis" in window) {
      const voices = await getVoices();


      const amharicVoices = voices.filter(voice => {
        const language = voice.lang
          .toLowerCase()
          .replace("_", "-");


        const name = voice.name.toLowerCase();


        return (
          language === "am" ||
          language.startsWith("am-") ||
          name.includes("amharic") ||
          name.includes("ameha") ||
          name.includes("mekdes")
        );
      });


      if (amharicVoices.length) {
        const utterance = new SpeechSynthesisUtterance(amharicText);


        utterance.voice = amharicVoices[0];
        utterance.lang = amharicVoices[0].lang || "am-ET";
        utterance.rate = 0.85;
        utterance.pitch = 1;


        utterance.onend = () => {
          speakAmharicBtn.textContent = originalLabel;
        };


        utterance.onerror = () => {
          speakAmharicBtn.textContent = originalLabel;
        };


        speechSynthesis.speak(utterance);
        return;
      }
    }


    await speakOnline(amharicText, "am");
  } catch (error) {
    console.warn("Amharic read-aloud failed:", error);


    alert(
      "Amharic read-aloud is not available in this browser. The Amharic answer is shown on screen.\n\nየአማርኛ ድምፅ ንባብ በዚህ አሳሽ ላይ አይገኝም። የአማርኛ መልሱ በማያ ላይ ታያለ።"
    );
  }


  speakAmharicBtn.textContent = originalLabel;
}


function clearAll() {
  questionInput.value = "";
  answerBox.value = "";
  stopAllSpeech();
  autoResizeAnswer();
}


async function copyAnswer() {
  const text = answerBox.value;


  if (!text) {
    return;
  }


  try {
    await navigator.clipboard.writeText(text);


    copyBtn.textContent = getText("copied");
    announce(getText("copied"));


    setTimeout(() => {
      copyBtn.textContent = getText("copy");
    }, 1600);
  } catch (error) {
    alert(getText("copyFailed"));
  }
}


function requestHelp() {
  const question = questionInput.value.trim();
  const answer = answerBox.value.trim();

  let message = "Hello, I need help with my learning question.\n\n";

  if (question) {
    message += "Question:\n" + question + "\n\n";
  }

  if (answer) {
    message += "Current answer:\n" + answer + "\n\n";
  }

  message += "Please help me understand this.";

  const telegramUrl =
    "https://t.me/EbaMengistuBot?text=" +
    encodeURIComponent(message);

  window.open(telegramUrl, "_blank");

  announce(getText("helpOpened"));
}


function startVoice(language, button) {
  const Recognizer =
    window.SpeechRecognition || window.webkitSpeechRecognition;


  if (!Recognizer) {
    alert(getText("micUnsupported"));
    return;
  }


  stopAllSpeech();
  playBeep();


  const recognizer = new Recognizer();
  recognizer.lang = language;
  recognizer.interimResults = false;
  recognizer.maxAlternatives = 3;


  const originalLabel = button.textContent;


  button.textContent = getText("listening");


  recognizer.onresult = event => {
    const spokenText = event.results[0][0].transcript.trim();
    const hasAmharic = /[\u1200-\u137F]/.test(spokenText);
    const expectedAmharic = language === "am-ET";


    if (expectedAmharic && !hasAmharic) {
      alert(getText("amharicOnly"));
      return;
    }


    if (!expectedAmharic && hasAmharic) {
      alert(getText("englishOnly"));
      return;
    }


    questionInput.value = spokenText;
    playBeep();
  };


  recognizer.onerror = event => {
    const error = event.error;


    if (error === "not-allowed" || error === "service-not-allowed") {
      alert(getText("micPermission"));
    } else {
      alert(getText("micFailed"));
    }
  };


  recognizer.onend = () => {
    button.textContent = originalLabel;
  };


  try {
    recognizer.start();
  } catch (error) {
    button.textContent = originalLabel;
    alert(getText("micFailed"));
  }
}


function updateConnectionStatus() {
  const online = navigator.onLine !== false;


  onlineStatus.textContent = online
    ? getText("online")
    : getText("offline");


  onlineStatus.className = online
    ? "online-status online"
    : "online-status offline";
}


window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);


if (localStorage.getItem("highContrast") === "true") {
  document.body.classList.add("high-contrast");
  contrastBtn.setAttribute("aria-pressed", "true");
}


setLanguage(currentLang);
updateConnectionStatus();


loadCourseData().catch(() => {
  // getAnswer() displays an error and retries when the learner asks.
});