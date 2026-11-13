const questionInput = document.getElementById("question");
const answerBox = document.getElementById("answer");
const getAnswerBtn = document.getElementById("getAnswerBtn");
const speakEnglishBtn = document.getElementById("speakEnglishBtn");
const speakAmharicBtn = document.getElementById("speakAmharicBtn");
const contrastBtn = document.getElementById("contrastBtn");
const clearBtn = document.getElementById("clearBtn");
const copyBtn = document.getElementById("copyBtn");
const fontSmall = document.getElementById("fontSmall");
const fontNormal = document.getElementById("fontNormal");
const fontLarge = document.getElementById("fontLarge");
const voiceAmharicBtn = document.getElementById("voiceAmharicBtn");
const voiceEnglishBtn = document.getElementById("voiceEnglishBtn");
const liveRegion = document.getElementById("liveRegion");


let currentFontSize = 1.05;


// Softer beep
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {}
}


if (localStorage.getItem("highContrast") === "true") {
  document.body.classList.add("high-contrast");
  if (contrastBtn) contrastBtn.setAttribute("aria-pressed", "true");
}


function getVoices() {
  return new Promise(resolve => {
    if (!("speechSynthesis" in window)) return resolve([]);   // NEW: safe on browsers without TTS
    let voices = speechSynthesis.getVoices();
    if (voices.length) return resolve(voices);
    const timeout = setTimeout(() => resolve(speechSynthesis.getVoices()), 1200);
    speechSynthesis.addEventListener("voiceschanged", () => {
      clearTimeout(timeout);
      resolve(speechSynthesis.getVoices());
    }, { once: true });
  });
}


function hasWord(text, words) {
  return words.some(w => new RegExp(`\\b${w}\\b`, "i").test(text));
}


document.querySelectorAll("button").forEach(btn => {
  btn.addEventListener("click", function () {
    document.querySelectorAll("button").forEach(b => b.classList.remove("active-primary"));
    this.classList.add("active-primary");
  });
});


if (getAnswerBtn) getAnswerBtn.addEventListener("click", getAnswer);
if (speakEnglishBtn) speakEnglishBtn.addEventListener("click", speakEnglish);
if (speakAmharicBtn) speakAmharicBtn.addEventListener("click", speakAmharic);


if (contrastBtn) {
  contrastBtn.addEventListener("click", () => {
    const on = document.body.classList.toggle("high-contrast");
    contrastBtn.setAttribute("aria-pressed", on);
    localStorage.setItem("highContrast", on);
  });
}


if (clearBtn) clearBtn.addEventListener("click", clearAll);
if (copyBtn) copyBtn.addEventListener("click", copyAnswer);


if (voiceAmharicBtn) voiceAmharicBtn.addEventListener("click", () => startVoice("am-ET", voiceAmharicBtn));
if (voiceEnglishBtn) voiceEnglishBtn.addEventListener("click", () => startVoice("en-US", voiceEnglishBtn));


if (fontSmall) fontSmall.addEventListener("click", () => changeFontSize(-0.08));
if (fontNormal) fontNormal.addEventListener("click", () => changeFontSize(0, true));
if (fontLarge) fontLarge.addEventListener("click", () => changeFontSize(0.08));


document.querySelectorAll(".suggest").forEach(btn => {
  btn.addEventListener("click", () => {
    questionInput.value = btn.dataset.q;
    questionInput.focus();
  });
});


function changeFontSize(delta, reset = false) {
  currentFontSize = reset ? 1.05 : Math.max(0.9, Math.min(1.6, currentFontSize + delta));
  if (answerBox) answerBox.style.fontSize = currentFontSize + "rem";
  if (questionInput) questionInput.style.fontSize = currentFontSize + "rem";
  autoResizeAnswer();
}


function autoResizeAnswer() {
  if (!answerBox) return;
  answerBox.style.height = "auto";
  answerBox.style.height = (answerBox.scrollHeight + 8) + "px";
}


async function getAnswer() {
  const question = questionInput.value.trim();
  if (!question) {
    const msg = "Please type a question.\nእባክዎ ጥያቄ ይጻፉ።";
    answerBox.value = msg;
    if (liveRegion) liveRegion.textContent = msg;
    autoResizeAnswer();
    return;
  }

  stopAllSpeech();

  // 1) Built-in answers (fast, work offline)
  const local = getLocalAnswer(question);
  if (local) return showAnswer(local);

  // 2) Asked before? Use the saved answer (works offline too)
  const saved = getSavedAnswer(question);
  if (saved) return showAnswer(saved);

  // 3) New question but no internet -> friendly message
  if (!isOnline()) return showAnswer(OFFLINE_MESSAGE);

  // 4) New question + internet -> ask the Railway backend (Groq bilingual answer)
  showAnswer("🔎 እየፈለግሁ ነው... / Searching...");
  if (getAnswerBtn) getAnswerBtn.disabled = true;
  try {
    const backendUrl = window.BACKEND_URL || "/api/ask";
    const response = await fetch(backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: question,
        language: /[\u1200-\u137F]/.test(question) ? "am" : "en",
        simpleMode: false
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "The answer service could not complete the request.");
    }

    const answer = data.answer || [
      data.answerEn && `🇬🇧 English:\n${data.answerEn}`,
      data.answerAm && `🇪🇹 አማርኛ:\n${data.answerAm}`,
      data.source && `📚 Source / ምንጭ: ${data.source}`
    ].filter(Boolean).join("\n\n");

    showAnswer(answer);
    saveAnswer(question, answer);

  } catch (err) {
    console.warn("Backend answer failed:", err);

    if (!isOnline()) {
      showAnswer(OFFLINE_MESSAGE);
      return;
    }

    showAnswer(
      "Sorry, I could not get an answer right now. Please try again later.\n\n" +
      "ይቅርታ፣ አሁን መልስ ማግኘት አልቻልኩም። እባክዎ እንደገና ይሞክሩ።"
    );
  } finally {
    if (getAnswerBtn) getAnswerBtn.disabled = false;
  }
}

/* ---------- NEW: offline support ---------- */
function isOnline() {
  return navigator.onLine !== false;
}

const OFFLINE_MESSAGE =
  "📶 This is a new question and it needs internet. Please connect to the internet to get a better answer. " +
  "Without internet you can still ask about greetings, time, date, Ethiopian date, math, Ethiopia and accessibility.\n\n" +
  "📶 ይህ አዲስ ጥያቄ ኢንተርኔት ያስፈልገዋል። የተሻለ መልስ ለማግኘት እባክዎ ኢንተርኔት ያገናኙ። " +
  "ያለ ኢንተርኔት ስለ ሰላምታ፣ ሰዓት፣ ቀን፣ የኢትዮጵያ ቀን፣ ሂሳብ፣ ኢትዮጵያ እና ተደራሽነት መጠየቅ ይችላሉ።";

// Saved answers (so questions asked before also work offline)
const SAVED_KEY = "savedAnswers_v1";
function loadSaved() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY)) || {}; } catch (e) { return {}; }
}
function getSavedAnswer(question) {
  return loadSaved()[question.trim().toLowerCase()] || null;
}
function saveAnswer(question, answer) {
  try {
    const all = loadSaved();
    all[question.trim().toLowerCase()] = answer;
    const keys = Object.keys(all);
    if (keys.length > 100) delete all[keys[0]];     // keep the last 100
    localStorage.setItem(SAVED_KEY, JSON.stringify(all));
  } catch (e) {}
}

// Small online/offline badge + message when connection changes
function updateConnectionBadge(announceChange) {
  let badge = document.getElementById("netBadge");
  if (!badge) {
    badge = document.createElement("div");
    badge.id = "netBadge";
    badge.setAttribute("role", "status");
    badge.style.cssText = "text-align:center;font-size:.85rem;font-weight:600;margin:4px 0 8px;";
    const main = document.getElementById("main");
    if (main) main.prepend(badge);
  }
  const on = isOnline();
  badge.textContent = on ? "🟢 ኢንተርኔት አለ / Online" : "🔴 ኢንተርኔት የለም — መሰረታዊ መልሶች ይሰራሉ / Offline — basic answers still work";
  badge.style.color = on ? "#0a7d3b" : "#b3261e";
  if (announceChange && liveRegion) liveRegion.textContent = badge.textContent;
}
window.addEventListener("online", () => updateConnectionBadge(true));
window.addEventListener("offline", () => updateConnectionBadge(true));
document.addEventListener("DOMContentLoaded", () => updateConnectionBadge(false));
if (document.readyState !== "loading") setTimeout(() => updateConnectionBadge(false), 0);

function showAnswer(text) {
  answerBox.value = text;
  if (liveRegion) liveRegion.textContent = text;
  autoResizeAnswer();
}


function getLocalAnswer(question) {
  const q = question.toLowerCase();
  const now = new Date();
  let reply = "";


  // Greetings
  if (hasWord(q, ["hello", "hi", "hey", "selam"]) || q.includes("ሰላም")) {
    reply = "Hello! Welcome. I'm here to help you with questions about learning, accessibility, and more. What would you like to know today?\n\nሰላም! እንኳን ደህና መጡ። ስለ ትምህርት፣ ተደራሽነት እና ሌሎች ጥያቄዎች ልረዳዎት እችላለሁ። ዛሬ ምን ማወቅ ይፈልጋሉ?";
  }
  else if (hasWord(q, ["morning"]) || q.includes("እንደምን አደር")) {
    reply = "Good morning! I hope you have a peaceful and productive day ahead.\n\nእንደምን አደሩ! መልካም እና ሰላማዊ ቀን ይሁንልዎ።";
  }
  else if (hasWord(q, ["afternoon"]) || q.includes("እንደምን ዋል")) {
    reply = "Good afternoon! How is your day going so far?\n\nእንደምን ዋሉ! ቀንዎ እንዴት እየሄደ ነው?";
  }
  else if (hasWord(q, ["evening"]) || q.includes("እንደምን አመሽ")) {
    reply = "Good evening! I hope you're having a relaxing time.\n\nእንደምን አመሹ! መልካም ምሽት።";
  }
  else if (hasWord(q, ["thank", "thanks"]) || q.includes("አመሰግናለሁ")) {
    reply = "You're very welcome! I'm happy to help. Feel free to ask more questions anytime.\n\nበጣም አመሰግናለሁ! ሌላ ጥያቄ ካለዎት በማንኛውም ጊዜ ይጠይቁ።";
  }
  else if (hasWord(q, ["bye", "goodbye"]) || q.includes("ቻው") || q.includes("ደህና ሁን")) {
    reply = "Goodbye! Take care and have a wonderful day. See you next time.\n\nደህና ሁኑ! መልካም ቀን ይሁንልዎ።";
  }


  // Time, Date, Year, Month
  else if (hasWord(q, ["time"]) || q.includes("ሰዓት")) {
    const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    reply = `The current time is ${time}.\n\nአሁን ሰዓቱ ${time} ነው።`;
  }
  else if ((hasWord(q, ["year"]) || q.includes("አመት") || q.includes("ዓመት")) && !isEthiopianDateQuestion(q)) {
    reply = `We are currently in the year ${now.getFullYear()}.\n\nአሁን ዓመቱ ${now.getFullYear()} ነው።`;
  }
  else if ((hasWord(q, ["month"]) || q.includes("ወር")) && !isEthiopianDateQuestion(q)) {
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    reply = `The current month is ${months[now.getMonth()]}.\n\nወሩ ${months[now.getMonth()]} ነው።`;
  }
  else if ((hasWord(q, ["date", "today", "day"]) || q.includes("ዛሬ") || q.includes("ቀን")) && !isEthiopianDateQuestion(q)) {
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const amDays = ["እሑድ","ሰኞ","ማክሰኞ","ረቡዕ","ሐሙስ","አርብ","ቅዳሜ"];
    reply = `Today is ${days[now.getDay()]}.\n\nዛሬ ${amDays[now.getDay()]} ነው።`;
  }


  // Countries
  else if (hasWord(q, ["ethiopia"]) || q.includes("ኢትዮጵያ")) {
    reply = "Ethiopia is a country located in East Africa. It has a rich history and culture. The capital city is Addis Ababa.\n\nኢትዮጵያ በምሥራቅ አፍሪካ ያለች ሀገር ናት። የበለጸገ ታሪክ እና ባህል አላት። ዋና ከተማዋ አዲስ አበባ ናት።";
  }
  else if (hasWord(q, ["kenya"]) || q.includes("ኬንያ")) {
    reply = "Kenya is a country in East Africa known for its wildlife and national parks. Its capital is Nairobi.\n\nኬንያ በምሥራቅ አፍሪካ ያለች ሀገር ናት። በዱር እንስሳት እና ብሔራዊ ፓርኮች ትታወቃለች። ዋና ከተማዋ ናይሮቢ ነው።";
  }
  else if (hasWord(q, ["addis"]) || q.includes("አዲስ አበባ")) {
    reply = "Addis Ababa is the capital and largest city of Ethiopia. It is an important political and cultural center.\n\nአዲስ አበባ የኢትዮጵያ ዋና ከተማ እና ትልቁ ከተማ ናት። አስፈላጊ የፖለቲካ እና የባህል ማዕከል ናት።";
  }


  // NEW: more built-in answers
  else if (hasWord(q, ["how are you"]) || q.includes("እንዴት ነህ") || q.includes("እንዴት ነሽ") || q.includes("እንዴት ኖት") || q.includes("እንዴት ነዎት")) {
    reply = "I'm doing well, thank you for asking! How can I help you today?\n\nደህና ነኝ፣ ስለጠየቁኝ አመሰግናለሁ! ዛሬ በምን ልርዳዎት?";
  }
  else if (hasWord(q, ["your name", "who are you"]) || q.includes("ስምህ") || q.includes("ስምሽ") || q.includes("ማን ነህ") || q.includes("ማን ነሽ")) {
    reply = "I am the Multilingual Learning Assistant. I answer questions in English and Amharic and can read answers aloud.\n\nእኔ የመማሪያ ረዳት ነኝ። በእንግሊዝኛ እና በአማርኛ ጥያቄዎችን እመልሳለሁ፣ መልሶችንም በድምፅ አነባለሁ።";
  }
  else if (hasWord(q, ["help"]) || q.includes("እርዳኝ") || q.includes("እርዳታ")) {
    reply = "You can ask me almost anything: science, history, countries, people, health, technology and more. You can also ask math like 25 * 4, or the Ethiopian date.\n\nማንኛውንም ጥያቄ መጠየቅ ይችላሉ፦ ሳይንስ፣ ታሪክ፣ ሀገራት፣ ሰዎች፣ ጤና፣ ቴክኖሎጂ እና ሌሎችም። እንደ 25 * 4 ያሉ የሂሳብ ጥያቄዎችን ወይም የኢትዮጵያን ቀን መጠየቅ ይችላሉ።";
  }
  else if (isEthiopianDateQuestion(q)) {
    const et = toEthiopianDate(now);
    reply = `Today in the Ethiopian calendar is ${et.monthEn} ${et.day}, ${et.year}.\n\nዛሬ በኢትዮጵያ ዘመን አቆጣጠር ${et.monthAm} ${et.day} ቀን ${et.year} ዓ.ም. ነው።`;
  }
  else if (isMathQuestion(q)) {
    const result = solveMath(q);
    reply = result === null ? "" : `The answer is ${result}.\n\nመልሱ ${result} ነው።`;
  }

  // Accessibility - Long Answers
  else if (hasWord(q, ["visual"]) || q.includes("ዕይታ")) {
    reply = "Visual support is designed for people who have low vision or are blind. This tool includes Read Aloud so users can listen to answers, High Contrast mode for better visibility, and text size controls. These features help make information more accessible and independent.\n\nየዕይታ ድጋፍ ማየት ለሚቸግራቸው ወይም ለዓይነ ስውራን የተሰራ ነው። ይህ መሳሪያ የድምፅ ንባብ፣ ከፍተኛ ንፅፅር እና የጽሑፍ መጠን ማስተካከል ያካትታል።";
  }
  else if (hasWord(q, ["hearing"]) || q.includes("መስማት")) {
    reply = "Hearing support helps people who are Deaf or hard of hearing. All answers are displayed clearly in written text in both Amharic and English, so users can access information without needing sound.\n\nየመስማት ድጋፍ ለመስማት ለሚቸግራቸው ሰዎች ይረዳል። መልሶች በአማርኛ እና በእንግሊዝኛ በጽሑፍ በግልጽ ይታያሉ።";
  }
  else if (hasWord(q, ["mobility"]) || q.includes("እንቅስቃሴ")) {
    reply = "Mobility support is for people with physical disabilities. The buttons are large and easy to press, and voice input is available so users do not always need to type with their hands.\n\nየእንቅስቃሴ ድጋፍ አካላዊ እንቅስቃሴ ለሚቸግራቸው ሰዎች የተሰራ ነው። ቁልፎች ትልቅ ናቸው እና የድምፅ ግብዓትም ይገኛል።";
  }
  else if (hasWord(q, ["learn", "learning", "hackathon", "project"]) || q.includes("መማር") || q.includes("ሃክአቶን")) {
    reply = "This Multilingual Learning Assistant was created for the Accessibility Hackathon 2026. The goal is to build simple and inclusive tools that help people who are blind, Deaf, have physical or cognitive disabilities, and refugees in Ethiopia access information and learning more easily.\n\nይህ የመማሪያ ረዳት ለተደራሽነት ሃክአቶን 2026 የተሰራ ነው። ዓላማው ለአካል ጉዳተኞች እና ስደተኞች ቀላል እና ተደራሽ መሳሪያዎችን መገንባት ነው።";
  }
  return reply || null;
}




/* =========================================================
   NEW: ANSWER ANY QUESTION (free, no API key)
   1) If the question is Amharic -> translate to English
   2) Search Wikipedia and take a short summary (3 sentences)
   3) Translate the summary to Amharic
   4) Show: English part, blank line, Amharic part
   ========================================================= */
const ETHIOPIC_RE = /[\u1200-\u137F]/;
const answerCache = {};

async function fetchJson(url, ms = 9000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Translate text. from/to = "en" | "am" | "auto"
async function translateText(text, from, to) {
  if (!text.trim()) return "";
  // Try Google first
  try {
    const url = "https://translate.googleapis.com/translate_a/single?client=gtx&dt=t" +
      "&sl=" + from + "&tl=" + to + "&q=" + encodeURIComponent(text);
    const data = await fetchJson(url);
    const out = data[0].map(part => part[0]).join("");
    if (out.trim()) return out;
  } catch (e) { console.warn("Google translate failed, trying MyMemory", e); }

  // Backup: MyMemory (max ~450 chars per request)
  const src = from === "auto" ? (ETHIOPIC_RE.test(text) ? "am" : "en") : from;
  const parts = splitForSpeech(text, 450);
  const results = [];
  for (const part of parts) {
    const url = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(part) +
      "&langpair=" + src + "|" + to;
    const data = await fetchJson(url);
    results.push(data.responseData.translatedText);
  }
  return results.join(" ");
}

// Turn a question into search words
function cleanQuestion(q) {
  return q
    .replace(/[?？!.።]/g, " ")
    .replace(/^\s*(please\s+)?(can you\s+)?(tell me|explain|define|describe|what('s| is| are| was| were)|who('s| is| are| was| were)|where('s| is| are| was)|when (is|was|did)|why (is|are|do|does)|how (do|does|is|are|to|did)|give me|i want to know)\s+(about\s+)?/i, "")
    .replace(/\b(the meaning of|meaning of|information about|info about)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Remove Amharic letters/brackets from English text (so reading works well)
function cleanEnglishSummary(text) {
  return text
    .replace(/\([^)]*[\u1200-\u137F][^)]*\)/g, "")
    .replace(/[\u1200-\u137F]+/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;])/g, "$1")
    .trim();
}

function firstSentences(text, n = 3) {
  const s = text.match(/[^.!?]+[.!?]+(\s|$)/g);
  return s ? s.slice(0, n).join("").trim() : text;
}

async function searchWikipedia(query) {
  const searchUrl = "https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=1&srsearch=" +
    encodeURIComponent(query);
  const data = await fetchJson(searchUrl);
  const hit = data.query && data.query.search && data.query.search[0];
  if (!hit) return null;

  const sumUrl = "https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(hit.title.replace(/ /g, "_"));
  const sum = await fetchJson(sumUrl);
  if (!sum.extract) return null;
  return { title: sum.title, text: firstSentences(cleanEnglishSummary(sum.extract), 2) };
}

async function getOnlineAnswer(question) {
  const key = question.toLowerCase();
  if (answerCache[key]) return answerCache[key];

  const isAmharic = ETHIOPIC_RE.test(question);

  // 1) Question in English (translate if Amharic)
  let englishQ = question;
  if (isAmharic) englishQ = await translateText(question, "am", "en");

  // 2) Search Wikipedia (try cleaned words first, then full question)
  let result = await searchWikipedia(cleanQuestion(englishQ) || englishQ);
  if (!result) result = await searchWikipedia(englishQ);
  if (!result) throw new Error("No result");

  // 3) Translate summary to Amharic
  let amharic = "";
  try { amharic = await translateText(result.text, "en", "am"); }
  catch (e) { amharic = "(የአማርኛ ትርጉም አሁን አልተገኘም።)"; }

  const answer = result.text + "\n\n" + amharic + "\n\n📚 Source / ምንጭ: Wikipedia – " + result.title;
  answerCache[key] = answer;
  saveAnswer(question, answer);
  return answer;
}


/* ---------- NEW: simple math (e.g. "what is 25 * 4", "12 plus 8") ---------- */
function normalizeMath(q) {
  return q.toLowerCase()
    .replace(/×|x(?=\s*\d)/g, "*").replace(/÷/g, "/")
    .replace(/\bplus\b|ሲደመር/g, "+").replace(/\bminus\b|ሲቀነስ/g, "-")
    .replace(/\btimes\b|\bmultiplied by\b|ሲባዛ/g, "*").replace(/\bdivided by\b|ሲካፈል/g, "/")
    .replace(/[^0-9+\-*/().\s]/g, " ")
    .replace(/\s+/g, " ").trim();
}
function isMathQuestion(q) {
  const m = normalizeMath(q);
  return /\d/.test(m) && /[+\-*/]/.test(m) && /^[0-9+\-*/().\s]+$/.test(m) && /\d\s*[+\-*/]\s*[\d(]/.test(m);
}
function solveMath(q) {
  try {
    const expr = normalizeMath(q);
    if (!/^[0-9+\-*/().\s]+$/.test(expr)) return null;
    const value = Function('"use strict"; return (' + expr + ')')();
    if (typeof value !== "number" || !isFinite(value)) return null;
    return Math.round(value * 10000) / 10000;
  } catch (e) { return null; }
}


/* ---------- NEW: Ethiopian calendar ---------- */
function isEthiopianDateQuestion(q) {
  return hasWord(q, ["ethiopian date", "ethiopian calendar", "ethiopian year", "ethiopian month"]) ||
         q.includes("የኢትዮጵያ ቀን") || q.includes("ዘመን አቆጣጠር") || q.includes("ዓ.ም") || q.includes("የኢትዮጵያ ወር");
}
function toEthiopianDate(date) {
  // Julian Day Number of the Gregorian date
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  const jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  // JDN -> Ethiopian (epoch 1724221)
  const r = (jdn - 1723856) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  const year = 4 * Math.floor((jdn - 1723856) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460);
  const month = Math.floor(n / 30) + 1;
  const day = (n % 30) + 1;
  const am = ["መስከረም","ጥቅምት","ኅዳር","ታኅሣሥ","ጥር","የካቲት","መጋቢት","ሚያዝያ","ግንቦት","ሰኔ","ሐምሌ","ነሐሴ","ጳጉሜ"];
  const en = ["Meskerem","Tikimt","Hidar","Tahsas","Tir","Yekatit","Megabit","Miyazya","Ginbot","Sene","Hamle","Nehase","Pagume"];
  return { year, month, day, monthAm: am[month - 1], monthEn: en[month - 1] };
}
/* ================= END NEW ANSWER CODE ================= */


/* =========================================================
   NEW: RECORDED VOICES (natural male voices, work OFFLINE)
   Built-in answers have recorded audio in /audio:
   English = Andrew (warm male), Amharic = Ameha (male)
   ========================================================= */
let CLIPS = {};
fetch("audio/manifest.json").then(r => r.json()).then(m => { CLIPS = m; }).catch(() => {});

function clipKey(text) { return text.replace(/\s+/g, " ").trim(); }
function findClip(text) { return CLIPS[clipKey(text)] || null; }

const clipUrls = {};
async function playClip(file) {
  // Load as a blob (works offline from the saved copy, also on iPhone Safari)
  if (!clipUrls[file]) {
    const res = await fetch(file);
    if (!res.ok) throw new Error("clip missing");
    clipUrls[file] = URL.createObjectURL(await res.blob());
  }
  if (stopRequested) return;
  return new Promise((resolve, reject) => {
    onlinePlayer.onended = resolve;
    onlinePlayer.onerror = () => reject("clip failed");
    onlinePlayer.src = clipUrls[file];
    onlinePlayer.playbackRate = 1;
    onlinePlayer.play().catch(reject);
  });
}

// Pick the softest male English voice the device has
const SOFT_MALE_EN = ["Andrew", "Brian", "Guy", "Christopher", "Eric", "Roger", "Ryan", "Daniel",
                      "Google UK English Male", "Alex", "Aaron", "Arthur", "Fred", "David", "Mark", "George", "Male"];
function pickEnglishVoices(voices) {
  const en = voices.filter(v => v.lang.toLowerCase().startsWith("en"));
  const score = v => {
    let i = SOFT_MALE_EN.findIndex(n => v.name.includes(n));
    let sc = i === -1 ? 100 : i;
    if (!isOnline() && !v.localService) sc += 1000;     // offline: device voices first
    if (/natural|neural|online/i.test(v.name) && isOnline()) sc -= 0.5;
    return sc;
  };
  return en.sort((a, b) => score(a) - score(b));
}

async function speakEnglish() {
  const text = answerBox.value;
  if (!text) return;
  stopAllSpeech();
  stopRequested = false;

  const clean = text.replace(/\n*📚.*$/s, "").trim();
  const cut = clean.search(/[\u1200-\u137F]/);
  const firstPara = clean.split(/\n\s*\n/)[0];
  const english = /[\u1200-\u137F]/.test(firstPara) ? (cut > 5 ? clean.slice(0, cut).trim() : clean) : firstPara.trim();

  // 1) Recorded natural voice (works offline)
  const clip = findClip(english);
  if (clip) {
    try { await playClip(clip); return; }
    catch (e) { if (stopRequested) return; console.warn("English clip failed", e); }
  }

  // 2) Device voice — softer male, slower and a bit warmer
  const voices = pickEnglishVoices(await getVoices());
  for (const voice of voices.slice(0, 3)) {
    try {
      await speakLocalVoice(english, voice, voice.lang, 0.92, 1.05);
      return;
    } catch (e) { if (stopRequested) return; console.warn("English voice failed:", voice.name, e); }
  }

  // 3) Online voice as last option
  try { await speakOnline(english, "en"); }
  catch (e) {
    if (!stopRequested) showVoiceStatus("⚠️ English voice is not available right now. The answer is shown on screen.", "warn");
  }
}


/* =========================================================
   NEW: AMHARIC READ ALOUD — works on Chrome (mobile + PC),
   Edge, Safari, Firefox, Samsung Internet.
   1) Uses the device Amharic voice if it exists (e.g. Edge)
   2) Otherwise uses Google's online Amharic voice (no API key)
   ========================================================= */

const onlinePlayer = new Audio();      // one reusable player (needed on mobile)
let amharicPlaying = false;
let stopRequested = false;

// Split text into parts of max ~180 characters (Google limit)
function splitForSpeech(text, max = 180) {
  const parts = text.replace(/\s+/g, " ").trim().split(/(?<=[።፤፥፣፡?!.,;:])\s*/);
  const chunks = [];
  let cur = "";
  for (const p of parts) {
    if ((cur + " " + p).trim().length <= max) { cur = (cur + " " + p).trim(); continue; }
    if (cur) chunks.push(cur);
    if (p.length <= max) { cur = p; continue; }
    cur = "";
    for (const w of p.split(" ")) {
      if ((cur + " " + w).trim().length > max) { if (cur) chunks.push(cur); cur = w; }
      else cur = (cur + " " + w).trim();
    }
  }
  if (cur) chunks.push(cur);
  return chunks.filter(Boolean);
}

function playAudioUrl(url) {
  return new Promise((resolve, reject) => {
    onlinePlayer.onended = resolve;
    onlinePlayer.onerror = () => reject("audio failed");
    onlinePlayer.src = url;
    onlinePlayer.play().catch(reject);
  });
}

// Online voice (Google). lang = "am" or "en"
async function speakOnline(text, lang) {
  stopRequested = false;
  const urls = [
    t => `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${encodeURIComponent(t)}`,
    t => `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=${lang}&q=${encodeURIComponent(t)}`
  ];
  for (const chunk of splitForSpeech(text)) {
    if (stopRequested) return;
    let ok = false, lastErr;
    for (const makeUrl of urls) {
      try { await playAudioUrl(makeUrl(chunk)); ok = true; break; }
      catch (e) { lastErr = e; if (stopRequested) return; }
    }
    if (!ok) throw lastErr;
  }
}

function speakLocalVoice(text, voice, lang, rate, pitch = 1) {
  return new Promise((resolve, reject) => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = lang;
    u.rate = rate;
    u.pitch = pitch;
    let started = false;
    u.onstart = () => { started = true; };
    u.onend = resolve;
    u.onerror = e => reject(e.error || "speech error");
    speechSynthesis.speak(u);
    // If the voice does not start in 4 seconds, treat it as failed
    setTimeout(() => { if (!started && !stopRequested) { speechSynthesis.cancel(); reject("voice did not start"); } }, 4000);
  });
}

function setAmharicButton(playing) {
  if (!speakAmharicBtn) return;
  if (!speakAmharicBtn.dataset.label) speakAmharicBtn.dataset.label = speakAmharicBtn.textContent;
  speakAmharicBtn.textContent = playing ? "⏹ አቁም" : speakAmharicBtn.dataset.label;
  speakAmharicBtn.setAttribute("aria-pressed", playing ? "true" : "false");
}

function stopAllSpeech() {
  stopRequested = true;
  amharicPlaying = false;
  try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
  onlinePlayer.pause();
  onlinePlayer.removeAttribute("src");
  onlinePlayer.load();
  setAmharicButton(false);
}

async function speakAmharic() {
  // Press again while reading = stop
  if (amharicPlaying) {
    stopAllSpeech();
    if (liveRegion) liveRegion.textContent = "ንባብ ቆሟል";
    return;
  }

  const text = answerBox.value;
  if (!text) return showVoiceStatus("ለማንበብ መልስ የለም። / No answer to read.", "warn");

  // Take only the Amharic part (after the English part)
  // Take only the Amharic part (2nd paragraph), skip the source line
  const clean = text.replace(/\n*📚.*$/s, "").trim();
  const paras = clean.split(/\n\s*\n/);
  let amharicText = paras.length > 1 ? paras.slice(1).join(" ").trim() : "";
  if (!/[\u1200-\u137F]/.test(amharicText)) {
    const start = clean.search(/[\u1200-\u137F]/);
    amharicText = start === -1 ? "" : clean.slice(start).trim();
  }
  if (!amharicText) return showVoiceStatus("ለማንበብ የአማርኛ ጽሑፍ የለም። / No Amharic text found.", "warn");

  stopAllSpeech();
  stopRequested = false;
  amharicPlaying = true;
  setAmharicButton(true);
  if (liveRegion) liveRegion.textContent = "አማርኛ እየተነበበ ነው";

  try {
    const voices = await getVoices();
    // 1) Recorded natural male voice (Ameha) — works offline
    const clip = findClip(amharicText);
    if (clip) {
      try {
        await playClip(clip);
        if (!stopRequested && liveRegion) liveRegion.textContent = "ንባብ ተጠናቋል";
        return;
      } catch (e) { if (stopRequested) return; console.warn("Amharic clip failed", e); }
    }

    // 2) Device Amharic voice (Ameha/Mekdes in Edge), 3) Google online voice
    const amVoices = voices.filter(v => v.lang.toLowerCase().replace("_", "-").startsWith("am"));
    const rank = v => (v.name.includes("Ameha") ? 0 : 1) + (v.localService ? 0 : (isOnline() ? 0.5 : 10));
    const tryOrder = amVoices.sort((a, b) => rank(a) - rank(b));

    let done = false;
    for (const voice of tryOrder) {
      try { await speakLocalVoice(amharicText, voice, "am-ET", 0.9); done = true; break; }
      catch (e) { if (stopRequested) return; console.warn("Amharic voice failed:", voice.name, e); }
    }
    if (!done && !stopRequested) {
      await speakOnline(amharicText, "am");                      // Google Amharic voice
    }
    if (!stopRequested && liveRegion) liveRegion.textContent = "ንባብ ተጠናቋል";
  } catch (err) {
    console.warn("Amharic read failed:", err);
    if (!stopRequested) {
      showVoiceStatus("📶 የአማርኛ ድምፅ አሁን አልተገኘም (ኢንተርኔት ሊያስፈልግ ይችላል)። ጽሑፉ በማያ ገጹ ላይ ይታያል። / Amharic voice not available now (may need internet). The text is shown on screen.", "warn");
    }
  } finally {
    amharicPlaying = false;
    setAmharicButton(false);
  }
}
/* ================= END NEW AMHARIC CODE ================= */


function clearAll() {
  if (questionInput) questionInput.value = "";
  if (answerBox) answerBox.value = "";
  stopAllSpeech();                                       // NEW: stops Amharic audio too
}


function copyAnswer() {
  if (!answerBox?.value) return;
  navigator.clipboard.writeText(answerBox.value);
}


/* =========================================================
   NEW: VOICE INPUT
   - Stops any reading before recording
   - 🎤 አማርኛ  = Amharic only  (warns if you speak English)
   - 🎤 English = English only (warns if you speak Amharic/other)
   - Press the mic again to stop listening
   ========================================================= */
const voiceStatus = document.getElementById("voiceStatus");
let activeRecognizer = null;

function showVoiceStatus(msg, type = "info") {
  if (voiceStatus) {
    voiceStatus.textContent = msg;
    voiceStatus.className = "voice-status " + type;
  }
  if (liveRegion) liveRegion.textContent = msg;
}

function playWarnBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(260, ctx.currentTime);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {}
}

/* ---------- NEW: language checks for the mic buttons ---------- */
const ETH_LETTER = /[\u1200-\u137F]/g;

// Common English words (if most words are here, it is English)
const COMMON_EN = new Set(("a about above after again all am an and any are as ask at be because been before being " +
 "best better big book but by call can capital city come could country day did do does doing done down each " +
 "eat english ethiopia ethiopian every explain find first for from food future get give go going good great " +
 "had has have he health hear hearing hello help her here hi him his history home hot how i if in into is it " +
 "its job just know language large last learn learning let life like little live long look make man many may " +
 "me mean meaning more most much must my name need new news next no not now number of off old on one only or " +
 "other our out over people person place plant please read right said say school science see she should show " +
 "small so some speak start student study support tell than thank thanks that the their them then there these " +
 "they thing think this those time to today tomorrow too two under up us use very visual want was water way we " +
 "weather well were what when where which who why will with woman work world would write year yes yesterday you " +
 "your morning afternoon evening night good bye goodbye hey okay ok teacher class university computer phone " +
 "internet accessibility disability blind deaf mobility hackathon project question answer africa addis ababa " +
 "kenya math plus minus times divided is are was the of three four five six seven eight nine ten hundred " +
 "thousand million capital population president king queen river mountain animal disease doctor medicine " +
 "god church sun moon earth sky rain coffee").split(" "));

// Amharic words that English recognition often writes in Latin letters
const AM_ROMAN = ["selam","salam","selamnew","endet","indet","neh","nesh","noh","nachu","ameseginalehu",
 "amesegnalehu","eshi","ishi","awo","aydelem","betam","tenastelign","tenayistilign","dehna","dena","deh",
 "yelem","alle","ale","new","nat","nachew","min","man","yet","lemin","melkam","konjo","gobez","wedaje",
 "abet","bakih","bakish","egziabher","yikirta","chigir","yelegnim","ande","hulet","sost","ishi"];

function looksLikeAmharic(text, confidence) {
  const eth = (text.match(ETH_LETTER) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  if (eth === 0) return false;
  if (latin > eth) return false;
  if (confidence > 0 && confidence < 0.35) return false;
  return true;
}

function looksLikeEnglish(text, confidence, alternatives = []) {
  // Any Amharic letters (in the answer or the alternatives) = not English
  if (/[\u1200-\u137F]/.test(text) || alternatives.some(a => /[\u1200-\u137F]/.test(a))) return false;

  const words = text.toLowerCase().replace(/[^a-z'\s]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;

  // Amharic words written in Latin letters (e.g. "selam endet neh")
  const amHits = words.filter(w => AM_ROMAN.includes(w)).length;
  if (amHits >= 1 && amHits >= words.length / 3) return false;

  // Chrome is not sure it heard English
  if (confidence > 0 && confidence < 0.6) return false;

  // How many words are common English words?
  const known = words.filter(w => COMMON_EN.has(w.replace(/'s$/, ""))).length;
  const ratio = known / words.length;
  if (words.length >= 3 && ratio < 0.34) return false;
  if (words.length === 2 && known === 0 && confidence < 0.85) return false;
  if (words.length === 1 && known === 0 && confidence > 0 && confidence < 0.8) return false;

  return true;
}

// Say the warning out loud
async function speakWarning(isAmMode) {
  setTimeout(async () => {
    try {
      if (isAmMode) {
        await speakOnline("ይህ ቁልፍ ለአማርኛ ብቻ ነው። እባክዎ በአማርኛ ይናገሩ።", "am");
      } else if ("speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance("This button is for English only. Please speak in English.");
        u.lang = "en-US";
        u.rate = 0.95;
        speechSynthesis.speak(u);
      }
    } catch (e) {}
  }, 400);   // wait for the warning beep
}

// Add spoken text where the cursor is (or at the end) — never deletes old text
function addToQuestion(text) {
  const el = questionInput;
  const old = el.value;
  let pos = (document.activeElement === el && typeof el.selectionStart === "number") ? el.selectionStart : old.length;
  const end = (document.activeElement === el && typeof el.selectionEnd === "number") ? el.selectionEnd : pos;
  const before = old.slice(0, pos);
  const after = old.slice(end);
  const spaceBefore = before && !/\s$/.test(before) ? " " : "";
  const spaceAfter = after && !/^\s/.test(after) ? " " : "";
  el.value = before + spaceBefore + text + spaceAfter + after;
  const caret = (before + spaceBefore + text).length;
  try { el.setSelectionRange(caret, caret); } catch (e) {}
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/* ---------- NEW: offline voice typing (Chrome 139+ on-device) ----------
   Chrome can recognise speech ON the device after a one-time language
   pack download. We use it when available, so the mic works offline.
   (Amharic on-device packs may not exist yet -> then internet is needed.) */
async function onDeviceStatus(Rec, lang) {
  if (typeof Rec.available !== "function") return "unsupported";
  try { return await Rec.available({ langs: [lang], processLocally: true }); }
  catch (e) { return "unsupported"; }
}

// While online, quietly download the offline packs for next time
async function prepareOfflineVoiceTyping() {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Rec || typeof Rec.install !== "function" || !isOnline()) return;
  for (const lang of ["en-US", "am-ET"]) {
    const st = await onDeviceStatus(Rec, lang);
    if (st === "downloadable") {
      try { await Rec.install({ langs: [lang], processLocally: true }); } catch (e) {}
    }
  }
}

async function startRecognizer(r, Rec, lang, isAmMode, button, original) {
  const st = await onDeviceStatus(Rec, lang);
  if (st === "available") {
    r.processLocally = true;          // works with or without internet
    r._wentLocal = true;
  } else if (!isOnline()) {
    // Offline and no on-device pack -> explain instead of failing silently
    activeRecognizer = null;
    button.textContent = original;
    button.setAttribute("aria-pressed", "false");
    playWarnBeep();
    showVoiceStatus(isAmMode
      ? "📶 የአማርኛ ድምፅ ግብዓት ያለ ኢንተርኔት አይሰራም። እባክዎ ይጻፉ ወይም ኢንተርኔት ያገናኙ።"
      : "📶 Offline English voice typing is not ready. Connect to the internet once, press 🎤 English, then it can work offline.", "warn");
    return;
  }
  r.start();
  // Online: download the offline pack in the background for next time
  if (st === "downloadable" && isOnline()) prepareOfflineVoiceTyping();
}

function startVoice(lang, button) {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Rec) {
    showVoiceStatus("የድምፅ ግብዓት Chrome ወይም Edge ላይ ይሰራል። / Voice input works in Chrome or Edge.", "warn");
    return;
  }

  // Press again while listening = stop
  if (activeRecognizer) {
    activeRecognizer.abort();
    return;
  }

  // 1) Stop any reading aloud first
  stopAllSpeech();

  const isAmMode = lang === "am-ET";
  const r = new Rec();
  r.lang = lang;
  r.interimResults = false;
  r.maxAlternatives = 3;
  activeRecognizer = r;
  r._wentLocal = false;

  const original = button.dataset.label || button.textContent;
  button.dataset.label = original;
  button.textContent = isAmMode ? "⏹ እያዳመጥኩ ነው..." : "⏹ Listening...";
  button.setAttribute("aria-pressed", "true");
  showVoiceStatus(isAmMode ? "🎤 በአማርኛ ይናገሩ..." : "🎤 Speak in English...", "info");

  // Small delay so the beep is not recorded
  playBeep();

  r.onresult = (e) => {
    const best = e.results[0][0];
    const text = best.transcript.trim();
    const confidence = typeof best.confidence === "number" ? best.confidence : 0;
    const alternatives = Array.from(e.results[0]).map(alt => alt.transcript);

    const wrongLanguage = isAmMode
      ? !looksLikeAmharic(text, confidence)
      : !looksLikeEnglish(text, confidence, alternatives);

    if (wrongLanguage) {
      playWarnBeep();
      showVoiceStatus(
        isAmMode
          ? "⚠️ ይህ ቁልፍ ለአማርኛ ብቻ ነው። እባክዎ በአማርኛ ይናገሩ። / Amharic only."
          : "⚠️ This button is for English only. Please speak in English. / እንግሊዝኛ ብቻ።",
        "warn"
      );
      speakWarning(isAmMode);   // also say it out loud (for blind users)
      return;   // do not type wrong-language text
    }

    addToQuestion(text);
    showVoiceStatus(isAmMode ? "✅ ተመዝግቧል። መልስ ያግኙ ይጫኑ።" : "✅ Got it. Press መልስ ያግኙ.", "ok");
  };

  r.onerror = (e) => {
    if (e.error === "aborted") {
      showVoiceStatus(isAmMode ? "ማዳመጥ ቆሟል።" : "Stopped listening.", "info");
    } else if (e.error === "no-speech") {
      showVoiceStatus(isAmMode ? "ምንም ድምፅ አልተሰማም። እንደገና ይሞክሩ።" : "No speech heard. Please try again.", "warn");
    } else if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      showVoiceStatus("ማይክሮፎን አልተፈቀደም። / Please allow microphone access.", "warn");
    } else if (e.error === "network" || (!isOnline() && e.error === "language-not-supported")) {
      showVoiceStatus(isAmMode
        ? "📶 የአማርኛ ድምፅ ግብዓት ያለ ኢንተርኔት አይሰራም። እባክዎ ይጻፉ ወይም ኢንተርኔት ያገናኙ።"
        : "📶 Offline English voice typing is not ready on this device. Please type, or connect once to download it.", "warn");
    } else if (e.error === "language-not-supported") {
      showVoiceStatus("ይህ አሳሽ ይህን ቋንቋ አይደግፍም። / This browser does not support this language.", "warn");
    } else if (e.error === "network") {
      showVoiceStatus("📶 የድምፅ ግብዓት አሁን አልሰራም (ኢንተርኔት ሊያስፈልግ ይችላል)። እባክዎ ይጻፉ። / Voice input not available now (may need internet). Please type.", "warn");
    } else {
      showVoiceStatus("ስህተት ተፈጥሯል። እንደገና ይሞክሩ። / Error, please try again.", "warn");
    }
  };

  r.onend = () => {
    activeRecognizer = null;
    button.textContent = original;
    button.setAttribute("aria-pressed", "false");
  };

  try {
    startRecognizer(r, Rec, lang, isAmMode, button, original).catch(() => {
      activeRecognizer = null;
      button.textContent = original;
      button.setAttribute("aria-pressed", "false");
      showVoiceStatus("እንደገና ይሞክሩ። / Please try again.", "warn");
    });
  } catch (err) {
    activeRecognizer = null;
    button.textContent = original;
    showVoiceStatus("እንደገና ይሞክሩ። / Please try again.", "warn");
  }
}


/* =========================================================
   NEW: OFFLINE APP (service worker)
   After the first visit with internet, the page, the script and
   all recorded voices are saved, so the tool opens and talks offline.
   ========================================================= */
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(err => console.warn("SW failed", err));
  });
}


