const questionInput = document.getElementById("question");
const answerBox = document.getElementById("answer");
const getAnswerBtn = document.getElementById("getAnswerBtn");
const speakAnswerBtn = document.getElementById("speakAnswerBtn");
const contrastBtn = document.getElementById("contrastBtn");
const clearBtn = document.getElementById("clearBtn");
const copyBtn = document.getElementById("copyBtn");
const fontSmall = document.getElementById("fontSmall");
const fontNormal = document.getElementById("fontNormal");
const fontLarge = document.getElementById("fontLarge");
const voiceAmharicBtn = document.getElementById("voiceAmharicBtn");
const voiceEnglishBtn = document.getElementById("voiceEnglishBtn");
const languageSelect = document.getElementById("languageSelect");
const voiceLanguageSelect = document.getElementById("voiceLanguageSelect");
const liveRegion = document.getElementById("liveRegion");
const voiceStatus = document.getElementById("voiceStatus");

let currentFontSize = 1.05;
let currentLanguage = localStorage.getItem("interfaceLanguage") || "en";
let readAloudLanguage = localStorage.getItem("readAloudLanguage") || "en";

let activeRecognizer = null;
let isSpeaking = false;
let stopRequested = false;

const onlinePlayer = new Audio();
const clipUrls = {};
let CLIPS = {};

const UI_TEXT = {
  en: {
    direction: "ltr",
    languageName: "English",
    questionLabel: "Type your question",
    questionPlaceholder: "Ask any question...",
    getAnswer: "Get answer",
    readAnswer: "🔊 Read answer",
    clear: "Clear",
    copy: "Copy",
    answerLabel: "Answer",
    answerPlaceholder: "Your answer will appear here...",
    highContrast: "High contrast",
    decreaseText: "Decrease text size",
    normalText: "Normal text size",
    increaseText: "Increase text size",
    voiceAmharic: "🎤 Amharic",
    voiceEnglish: "🎤 English",
    listening: "⏹ Listening...",
    noQuestion: "Please type a question.",
    searching: "🔎 Searching...",
    copied: "✅ Copied",
    languageChanged: "Interface language changed to English.",
    voiceChanged: "Read-aloud language changed to English.",
    textSize: "Text size is now {size}%.",
    stop: "⏹ Stop",
    noAnswer: "No answer to read.",
    voiceUnavailable:
      "⚠️ Voice is not available for this language right now. The answer is shown on screen.",
    online: "🟢 Online",
    offline:
      "🔴 Offline — basic answers still work",
    offlineMessage:
      "📶 This is a new question and it needs internet. Please connect to the internet to get a better answer. Without internet you can still ask about greetings, time, date, Ethiopian date, math, Ethiopia and accessibility.",
    answerFailed:
      "Sorry, I could not find an answer. Please check your internet connection or try asking in a different way.",
    microphoneUnsupported:
      "Voice input works in Chrome or Edge.",
    amharicOnly: "⚠️ This button is for Amharic only. Please speak in Amharic.",
    englishOnly:
      "⚠️ This button is for English only. Please speak in English.",
    recorded: "✅ Got it. Press Get answer.",
    stoppedListening: "Stopped listening.",
    noSpeech: "No speech heard. Please try again.",
    microphoneDenied: "Please allow microphone access.",
    languageUnsupported:
      "This browser does not support this language.",
    tryAgain: "Error, please try again.",
    speechStopped: "⏹ Speech stopped."
  },

  am: {
    direction: "ltr",
    languageName: "አማርኛ",
    questionLabel: "ጥያቄዎን ይጻፉ",
    questionPlaceholder: "ማንኛውንም ጥያቄ ይጠይቁ...",
    getAnswer: "መልስ ያግኙ",
    readAnswer: "🔊 መልስ አንብብ",
    clear: "አጽዳ",
    copy: "ቅዳ",
    answerLabel: "መልስ",
    answerPlaceholder: "መልስ እዚህ ይታያል...",
    highContrast: "ከፍተኛ ንፅፅር",
    decreaseText: "ጽሑፍ አንስ",
    normalText: "መደበኛ የጽሑፍ መጠን",
    increaseText: "ጽሑፍ አሳድል",
    voiceAmharic: "🎤 አማርኛ",
    voiceEnglish: "🎤 እንግሊዝኛ",
    listening: "⏹ እያዳመጥኩ ነው...",
    noQuestion: "እባክዎ ጥያቄ ይጻፉ።",
    searching: "🔎 እየፈለግሁ ነው...",
    copied: "✅ ተቀድቷል",
    languageChanged: "የመሣሪያው ቋንቋ ወደ አማርኛ ተቀይሯል።",
    voiceChanged: "የድምፅ ቋንቋ ወደ አማርኛ ተቀይሯል።",
    textSize: "የጽሑፍ መጠን {size}% ሆኗል።",
    stop: "⏹ አቁም",
    noAnswer: "ለማንበብ መልስ የለም።",
    voiceUnavailable:
      "⚠️ ለዚህ ቋንቋ ድምፅ አሁን አልተገኘም። መልሱ በማያ ገጹ ላይ ይታያል።",
    online: "🟢 ኢንተርኔት አለ",
    offline: "🔴 ኢንተርኔት የለም — መሰረታዊ መልሶች ይሰራሉ",
    offlineMessage:
      "📶 ይህ አዲስ ጥያቄ ኢንተርኔት ያስፈልገዋል። የተሻለ መልስ ለማግኘት እባክዎ ኢንተርኔት ያገናኙ። ያለ ኢንተርኔት ስለ ሰላምታ፣ ሰዓት፣ ቀን፣ የኢትዮጵያ ቀን፣ ሂሳብ፣ ኢትዮጵያ እና ተደራሽነት መጠየቅ ይችላሉ።",
    answerFailed:
      "ይቅርታ፣ መልስ ማግኘት አልቻልኩም። እባክዎ የኢንተርኔት ግንኙነትዎን ያረጋግጡ ወይም በሌላ መንገድ ይጠይቁ።",
    microphoneUnsupported:
      "የድምፅ ግብዓት Chrome ወይም Edge ላይ ይሰራል።",
    amharicOnly: "⚠️ ይህ ቁልፍ ለአማርኛ ብቻ ነው። እባክዎ በአማርኛ ይናገሩ።",
    englishOnly:
      "⚠️ ይህ ቁልፍ ለእንግሊዝኛ ብቻ ነው። እባክዎ በእንግሊዝኛ ይናገሩ።",
    recorded: "✅ ተመዝግቧል። መልስ ያግኙ ይጫኑ።",
    stoppedListening: "ማዳመጥ ቆሟል።",
    noSpeech: "ምንም ድምፅ አልተሰማም። እንደገና ይሞክሩ።",
    microphoneDenied: "እባክዎ ለማይክሮፎኑ ፈቃድ ይስጡ።",
    languageUnsupported: "ይህ አሳሽ ይህን ቋንቋ አይደግፍም።",
    tryAgain: "ስህተት ተፈጥሯል። እንደገና ይሞክሩ።",
    speechStopped: "⏹ ድምፅ ቆሟል።"
  },

  om: {
    direction: "ltr",
    languageName: "Afaan Oromoo",
    questionLabel: "Gaaffii kee barreessi",
    questionPlaceholder: "Gaaffii kamiifuu gaafadhu...",
    getAnswer: "Deebii argadhu",
    readAnswer: "🔊 Deebii dubbisi",
    clear: "Haqi",
    copy: "Copy godhi",
    answerLabel: "Deebii",
    answerPlaceholder: "Deebichi asitti mul'ata...",
    highContrast: "Walqabata cimaa",
    decreaseText: "Barreeffama xiqqeessi",
    normalText: "Guddina barreeffamaa idilee",
    increaseText: "Barreeffama guddisi",
    voiceAmharic: "🎤 Afaan Oromoo",
    voiceEnglish: "🎤 Ingliffaa",
    listening: "⏹ Dhagayaa jira...",
    noQuestion: "Maaloo gaaffii barreessi.",
    searching: "🔎 Barbaadaa jira...",
    copied: "✅ Copy taateera",
    languageChanged: "Afaan appiin Afaan Oromoo taateera.",
    voiceChanged: "Afaan sagalee Afaan Oromoo taateera.",
    textSize: "Guddina barreeffamaa {size}% taateera.",
    stop: "⏹ Dhaabsi",
    noAnswer: "Dubbisuuf deebii hin jiru.",
    voiceUnavailable:
      "⚠️ Sagaleen afaan kanaa yeroo ammaa hin argamu. Deebiin barreeffamaan mul'ata.",
    online: "🟢 Inteernetii jira",
    offline: "🔴 Inteernetii hin jiru — deebii bu'uuraa ni hojjatu",
    offlineMessage:
      "📶 Gaaffiin haaraan kun inteernetii barbaada. Deebii gaariidhaaf maaloo inteernetii hidhi. Inteernetii malee faarsa, sa'aata, guyyaa, guyyaa Itoophiyaa, herrega, Itoophiyaa fi dhiyooessa waliin gaafachuu dandeessu.",
    answerFailed:
      "Dhiifama, deebii arguu hin dandeenye. Maaloo inteernetii kee mirkaneessi yookiin gaaffii biraa gaafadhu.",
    microphoneUnsupported:
      "Sagaleen galchi Chrome yookiin Edge irratti hojjata.",
    amharicOnly:
      "⚠️ Qabjiin kun Afaan Oromoo qofaaf. Maaloo Afaan Oromootiin dubbadi.",
    englishOnly:
      "⚠️ Qabjiin kun Ingliffaa qofaaf. Maaloo Ingliffaatiin dubbadi.",
    recorded: "✅ Argameera. Deebii argadhu cuqaasi.",
    stoppedListening: "Dhagayuu dhaabe.",
    noSpeech: "Sagalee dhagayame hin jiru. Maaloo irra deebi'ii yaali.",
    microphoneDenied: "Maaloo mikirofooniif hayyama kenni.",
    languageUnsupported:
      "Braawzariin kun afaan kana hin deeggaru.",
    tryAgain: "Dogoggora uumeera. Maaloo irra deebi'ii yaali.",
    speechStopped: "⏹ Sagaleen dhaabameera."
  },

  ti: {
    direction: "ltr",
    languageName: "ትግርኛ",
    questionLabel: "ሕቶኻ ጽሓፍ",
    questionPlaceholder: "ዝኾነ ሕቶ ሕተቱ...",
    getAnswer: "መልሲ ረኽብ",
    readAnswer: "🔊 መልሲ ኣንብብ",
    clear: "ኣጥፉ",
    copy: "ቅዳ",
    answerLabel: "መልሲ",
    answerPlaceholder: "መልሲ ኣብዚ ይርኣይ...",
    highContrast: "ዓቢ ንጽጽር",
    decreaseText: "ጽሑፍ ኣንስ",
    normalText: "መደበኛ ዓቐን ጽሑፍ",
    increaseText: "ጽሑፍ ኣሳድል",
    voiceAmharic: "🎤 ትግርኛ",
    voiceEnglish: "🎤 እንግሊዝኛ",
    listening: "⏹ እየሰማዕኩ ኣሎሁ...",
    noQuestion: "በጃኻ ሕቶ ጽሓፍ።",
    searching: "🔎 እየደለኩ ኣሎሁ...",
    copied: "✅ ተቐዲሑ",
    languageChanged: "ቋንቋ መሣሪያ ናብ ትግርኛ ተቐይሩ ኣሎ።",
    voiceChanged: "ቋንቋ ድምጺ ናብ ትግርኛ ተቐይሩ ኣሎ።",
    textSize: "ዓቐን ጽሑፍ {size}% ኮይኑ ኣሎ።",
    stop: "⏹ ቆረጽ",
    noAnswer: "ንምንባብ መልሲ የሎን።",
    voiceUnavailable:
      "⚠️ ድምጺ ቋንቋዚ ኣብዚ እዋን ኣይርከብን። መልሲ ብጽሑፍ ይርኣይ።",
    online: "🟢 ኢንተርነት ኣሎ",
    offline: "🔴 ኢንተርነት የሎን — መሰረታዊ መልስታት ይሰርሑ",
    offlineMessage:
      "📶 እዚ ሓድሽ ሕቶ ኢንተርነት የድልዮ። ዝሓሸ መልሲ ንምርካብ በጃኻ ኢንተርነት ኣጥናቕ። ኢንተርነት የሎን እንተኾነ ብዛዕባ ሰላምታ፣ ሰዓት፣ ዕለት፣ መዓልቲ ኢትዮጵያ፣ ሕሳብ፣ ኢትዮጵያ ከምኡ’ውን ተበጻሕነት ትሕተት ትኽእል።",
    answerFailed:
      "ይቕረ፣ መልሲ ምርካብ ኣይከኣልኩን። በጃኻ ኢንተርነትካ ኣረጋግጽ ወይ ብካልእ መገዲ ሕተቱ።",
    microphoneUnsupported:
      "ድምጺ ምእታው ኣብ Chrome ወይ Edge ይሰርሕ።",
    amharicOnly: "⚠️ እዚ መልሲ ንትግርኛ ጥራይ እዩ። በጃኻ ብትግርኛ ዛረብ።",
    englishOnly:
      "⚠️ እዚ መልሲ ንእንግሊዝኛ ጥራይ እዩ። በጃኻ ብእንግሊዝኛ ዛረብ።",
    recorded: "✅ ተዘሪቡ ኣሎ። መልሲ ረኽብ ጠቅቡ።",
    stoppedListening: "ምስማዕ ተቖሪጹ ኣሎ።",
    noSpeech: "ድምጺ ኣይሰማዕኩን። በጃኻ ደግሙ።",
    microphoneDenied: "በጃኻ ንማይክሮፎን ፍቓድ ሃቡ።",
    languageUnsupported: "እዚ ብራውዘር እዚ ቋንቋ ኣይደግፎን።",
    tryAgain: "ጌጋ ተፈጢሩ ኣሎ። በጃኻ ደግሙ።",
    speechStopped: "⏹ ድምጺ ተቖሪጹ ኣሎ።"
  },

  ar: {
    direction: "rtl",
    languageName: "العربية",
    questionLabel: "اكتب سؤالك",
    questionPlaceholder: "اسأل أي سؤال...",
    getAnswer: "احصل على الإجابة",
    readAnswer: "🔊 اقرأ الإجابة",
    clear: "مسح",
    copy: "نسخ",
    answerLabel: "الإجابة",
    answerPlaceholder: "ستظهر الإجابة هنا...",
    highContrast: "تباين عالٍ",
    decreaseText: "تصغير النص",
    normalText: "حجم النص العادي",
    increaseText: "تكبير النص",
    voiceAmharic: "🎤 العربية",
    voiceEnglish: "🎤 الإنجليزية",
    listening: "⏹ أستمع...",
    noQuestion: "يرجى كتابة سؤال.",
    searching: "🔎 جارٍ البحث...",
    copied: "✅ تم النسخ",
    languageChanged: "تم تغيير لغة الواجهة إلى العربية.",
    voiceChanged: "تم تغيير لغة القراءة الصوتية إلى العربية.",
    textSize: "حجم النص الآن {size}%.",
    stop: "⏹ إيقاف",
    noAnswer: "لا توجد إجابة للقراءة.",
    voiceUnavailable:
      "⚠️ الصوت غير متاح لهذه اللغة الآن. تظهر الإجابة على الشاشة.",
    online: "🟢 متصل بالإنترنت",
    offline: "🔴 غير متصل — الإجابات الأساسية تعمل",
    offlineMessage:
      "📶 هذا سؤال جديد ويحتاج إلى الإنترنت. يرجى الاتصال بالإنترنت للحصول على إجابة أفضل. بدون إنترنت، يمكنك السؤال عن التحيات والوقت والتاريخ والتاريخ الإثيوبي والرياضيات وإثيوبيا وإمكانية الوصول.",
    answerFailed:
      "عذرًا، لم أتمكن من العثور على إجابة. يرجى التحقق من اتصال الإنترنت أو إعادة صياغة السؤال.",
    microphoneUnsupported:
      "يعمل الإدخال الصوتي في Chrome أو Edge.",
    amharicOnly: "⚠️ هذا الزر للعربية فقط. يرجى التحدث بالعربية.",
    englishOnly:
      "⚠️ هذا الزر للإنجليزية فقط. يرجى التحدث بالإنجليزية.",
    recorded: "✅ تم التسجيل. اضغط على احصل على الإجابة.",
    stoppedListening: "تم إيقاف الاستماع.",
    noSpeech: "لم يتم سماع أي صوت. يرجى المحاولة مرة أخرى.",
    microphoneDenied: "يرجى السماح بالوصول إلى الميكروفون.",
    languageUnsupported: "هذا المتصفح لا يدعم هذه اللغة.",
    tryAgain: "حدث خطأ. يرجى المحاولة مرة أخرى.",
    speechStopped: "⏹ تم إيقاف الصوت."
  }
};

const VOICE_LANGUAGE_CODES = {
  en: "en-US",
  am: "am-ET",
  om: "om-ET",
  ti: "ti-ET",
  ar: "ar"
};

const OFFLINE_MESSAGE = () => UI_TEXT[currentLanguage].offlineMessage;

const SAVED_KEY = "savedAnswers_v1";
const ETHIOPIC_RE = /[\u1200-\u137F]/;
const answerCache = {};

const SOFT_MALE_EN = [
  "Andrew", "Brian", "Guy", "Christopher", "Eric", "Roger", "Ryan",
  "Daniel", "Google UK English Male", "Alex", "Aaron", "Arthur",
  "Fred", "David", "Mark", "George", "Male"
];

const COMMON_EN = new Set((
  "a about above after again all am an and any are as ask at be because been before being " +
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
  "god church sun moon earth sky rain coffee"
).split(" "));

const AM_ROMAN = [
  "selam", "salam", "selamnew", "endet", "indet", "neh", "nesh", "noh",
  "nachu", "ameseginalehu", "amesegnalehu", "eshi", "ishi", "awo",
  "aydelem", "betam", "tenastelign", "tenayistilign", "dehna", "dena",
  "deh", "yelem", "alle", "ale", "new", "nat", "nachew", "min", "man",
  "yet", "lemin", "melkam", "konjo", "gobez", "wedaje", "abet", "bakih",
  "bakish", "egziabher", "yikirta", "chigir", "yelegnim", "ande",
  "hulet", "sost"
];

function getText(key) {
  const languageText = UI_TEXT[currentLanguage] || UI_TEXT.en;
  return languageText[key] || UI_TEXT.en[key] || "";
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

    oscillator.frequency.setValueAtTime(660, context.currentTime);
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      context.currentTime + 0.25
    );

    oscillator.start();
    oscillator.stop(context.currentTime + 0.25);
  } catch (error) {}
}

function playWarnBeep() {
  try {
    const context = new (
      window.AudioContext || window.webkitAudioContext
    )();

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "square";
    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.frequency.setValueAtTime(260, context.currentTime);
    gain.gain.setValueAtTime(0.05, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      context.currentTime + 0.35
    );

    oscillator.start();
    oscillator.stop(context.currentTime + 0.35);
  } catch (error) {}
}

function showVoiceStatus(message, type = "info") {
  if (voiceStatus) {
    voiceStatus.textContent = message;
    voiceStatus.className = "voice-status " + type;
  }

  if (liveRegion) {
    liveRegion.textContent = message;
  }
}

function isOnline() {
  return navigator.onLine !== false;
}

function hasWord(text, words) {
  return words.some(word => {
    return new RegExp("\\b" + word + "\\b", "i").test(text);
  });
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
    }, 1200);

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

function applyLanguage(language) {
  if (!UI_TEXT[language]) {
    language = "en";
  }

  currentLanguage = language;
  localStorage.setItem("interfaceLanguage", language);

  const text = UI_TEXT[language];

  const questionLabel = document.getElementById("questionLabel");
  const answerLabel = document.getElementById("answerLabel");

  if (questionLabel) {
    questionLabel.textContent = text.questionLabel;
  }

  if (answerLabel) {
    answerLabel.textContent = text.answerLabel;
  }

  if (questionInput) {
    questionInput.placeholder = text.questionPlaceholder;
  }

  if (answerBox) {
    answerBox.placeholder = text.answerPlaceholder;
  }

  if (getAnswerBtn) {
    getAnswerBtn.textContent = text.getAnswer;
  }

  if (speakAnswerBtn) {
    speakAnswerBtn.textContent = text.readAnswer;
    speakAnswerBtn.dataset.label = text.readAnswer;
  }

  if (clearBtn) {
    clearBtn.textContent = text.clear;
  }

  if (copyBtn) {
    copyBtn.textContent = text.copy;
  }

  if (contrastBtn) {
    contrastBtn.textContent = text.highContrast;
  }

  if (voiceAmharicBtn) {
    voiceAmharicBtn.textContent = text.voiceAmharic;
  }

  if (voiceEnglishBtn) {
    voiceEnglishBtn.textContent = text.voiceEnglish;
  }

  document.documentElement.lang = language;
  document.documentElement.dir = text.direction;
}

function changeFontSize(change, reset = false) {
  currentFontSize = reset
    ? 1.05
    : Math.max(0.9, Math.min(1.6, currentFontSize + change));

  if (questionInput) {
    questionInput.style.fontSize = currentFontSize + "rem";
  }

  if (answerBox) {
    answerBox.style.fontSize = currentFontSize + "rem";
  }

  autoResizeAnswer();

  const percent = Math.round(currentFontSize * 100);
  showVoiceStatus(
    getText("textSize").replace("{size}", percent),
    "info"
  );
}

function autoResizeAnswer() {
  if (!answerBox) return;

  answerBox.style.height = "auto";
  answerBox.style.height = answerBox.scrollHeight + 8 + "px";
}

function showAnswer(text) {
  if (!answerBox) return;

  answerBox.value = text;

  if (liveRegion) {
    liveRegion.textContent = text;
  }

  autoResizeAnswer();
}

function loadSavedAnswers() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY)) || {};
  } catch (error) {
    return {};
  }
}

function getSavedAnswer(question) {
  const saved = loadSavedAnswers();
  return saved[question.trim().toLowerCase()] || null;
}

function saveAnswer(question, answer) {
  try {
    const saved = loadSavedAnswers();
    saved[question.trim().toLowerCase()] = answer;

    const keys = Object.keys(saved);

    if (keys.length > 100) {
      delete saved[keys[0]];
    }

    localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
  } catch (error) {}
}

function updateConnectionBadge(announceChange) {
  let badge = document.getElementById("netBadge");

  if (!badge) {
    badge = document.createElement("div");
    badge.id = "netBadge";
    badge.setAttribute("role", "status");
    badge.style.cssText =
      "text-align:center;font-size:.85rem;font-weight:600;margin:4px 0 8px;";

    const main = document.getElementById("main");

    if (main) {
      main.prepend(badge);
    }
  }

  const online = isOnline();

  badge.textContent = online
    ? getText("online")
    : getText("offline");

  badge.style.color = online ? "#0a7d3b" : "#b3261e";

  if (announceChange && liveRegion) {
    liveRegion.textContent = badge.textContent;
  }
}

function isEthiopianDateQuestion(question) {
  return hasWord(question, [
    "ethiopian date",
    "ethiopian calendar",
    "ethiopian year",
    "ethiopian month"
  ]) ||
  question.includes("የኢትዮጵያ ቀን") ||
  question.includes("ዘመን አቆጣጠር") ||
  question.includes("ዓ.ም") ||
  question.includes("የኢትዮጵያ ወር");
}

function toEthiopianDate(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const adjustment = Math.floor((14 - month) / 12);
  const adjustedYear = year + 4800 - adjustment;
  const adjustedMonth = month + 12 * adjustment - 3;

  const julianDay =
    day +
    Math.floor((153 * adjustedMonth + 2) / 5) +
    365 * adjustedYear +
    Math.floor(adjustedYear / 4) -
    Math.floor(adjustedYear / 100) +
    Math.floor(adjustedYear / 400) -
    32045;

  const remainder = (julianDay - 1723856) % 1461;
  const dayCount =
    (remainder % 365) + 365 * Math.floor(remainder / 1460);

  const ethiopianYear =
    4 * Math.floor((julianDay - 1723856) / 1461) +
    Math.floor(remainder / 365) -
    Math.floor(remainder / 1460);

  const ethiopianMonth = Math.floor(dayCount / 30) + 1;
  const ethiopianDay = (dayCount % 30) + 1;

  const amharicMonths = [
    "መስከረም", "ጥቅምት", "ኅዳር", "ታኅሣሥ", "ጥር", "የካቲት",
    "መጋቢት", "ሚያዝያ", "ግንቦት", "ሰኔ", "ሐምሌ", "ነሐሴ", "ጳጉሜ"
  ];

  const englishMonths = [
    "Meskerem", "Tikimt", "Hidar", "Tahsas", "Tir", "Yekatit",
    "Megabit", "Miyazya", "Ginbot", "Sene", "Hamle", "Nehase", "Pagume"
  ];

  return {
    year: ethiopianYear,
    month: ethiopianMonth,
    day: ethiopianDay,
    monthAm: amharicMonths[ethiopianMonth - 1],
    monthEn: englishMonths[ethiopianMonth - 1]
  };
}

function normalizeMath(question) {
  return question
    .toLowerCase()
    .replace(/×|x(?=\s*\d)/g, "*")
    .replace(/÷/g, "/")
    .replace(/\bplus\b|ሲደመር/g, "+")
    .replace(/\bminus\b|ሲቀነስ/g, "-")
    .replace(/\btimes\b|\bmultiplied by\b|ሲባዛ/g, "*")
    .replace(/\bdivided by\b|ሲካፈል/g, "/")
    .replace(/[^0-9+\-*/().\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isMathQuestion(question) {
  const expression = normalizeMath(question);

  return /\d/.test(expression) &&
    /[+\-*/]/.test(expression) &&
    /^[0-9+\-*/().\s]+$/.test(expression) &&
    /\d\s*[+\-*/]\s*[\d(]/.test(expression);
}

function solveMath(question) {
  try {
    const expression = normalizeMath(question);

    if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
      return null;
    }

    if (expression.length > 100) {
      return null;
    }

    const value = Function(
      '"use strict"; return (' + expression + ")"
    )();

    if (typeof value !== "number" || !isFinite(value)) {
      return null;
    }

    return Math.round(value * 10000) / 10000;
  } catch (error) {
    return null;
  }
}

function getLocalAnswer(question) {
  const questionText = question.toLowerCase();
  const now = new Date();
  let reply = "";

  if (
    hasWord(questionText, ["hello", "hi", "hey", "selam"]) ||
    questionText.includes("ሰላም")
  ) {
    reply =
      "Hello! Welcome. I can help with learning, accessibility, and other questions.\n\n" +
      "ሰላም! እንኳን ደህና መጡ። ስለ ትምህርት፣ ተደራሽነት እና ሌሎች ጥያቄዎች ልረዳዎት እችላለሁ።";
  } else if (
    hasWord(questionText, ["morning"]) ||
    questionText.includes("እንደምን አደር")
  ) {
    reply =
      "Good morning! I hope you have a peaceful and productive day.\n\n" +
      "እንደምን አደሩ! መልካም እና ሰላማዊ ቀን ይሁንልዎ።";
  } else if (
    hasWord(questionText, ["afternoon"]) ||
    questionText.includes("እንደምን ዋል")
  ) {
    reply =
      "Good afternoon! How is your day going?\n\n" +
      "እንደምን ዋሉ! ቀንዎ እንዴት እየሄደ ነው?";
  } else if (
    hasWord(questionText, ["evening"]) ||
    questionText.includes("እንደምን አመሽ")
  ) {
    reply =
      "Good evening! I hope you are having a relaxing time.\n\n" +
      "እንደምን አመሹ! መልካም ምሽት።";
  } else if (
    hasWord(questionText, ["thank", "thanks"]) ||
    questionText.includes("አመሰግናለሁ")
  ) {
    reply =
      "You are welcome! I am happy to help.\n\n" +
      "በጣም አመሰግናለሁ! ሌላ ጥያቄ ካለዎት በማንኛውም ጊዜ ይጠይቁ።";
  } else if (
    hasWord(questionText, ["bye", "goodbye"]) ||
    questionText.includes("ቻው") ||
    questionText.includes("ደህና ሁን")
  ) {
    reply =
      "Goodbye! Take care and have a wonderful day.\n\n" +
      "ደህና ሁኑ! መልካም ቀን ይሁንልዎ።";
  } else if (
    hasWord(questionText, ["time"]) ||
    questionText.includes("ሰዓት")
  ) {
    const time = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit"
    });

    reply =
      "The current time is " + time + ".\n\nአሁን ሰዓቱ " + time + " ነው።";
  } else if (
    (hasWord(questionText, ["year"]) ||
      questionText.includes("አመት") ||
      questionText.includes("ዓመት")) &&
    !isEthiopianDateQuestion(questionText)
  ) {
    reply =
      "We are currently in the year " + now.getFullYear() + ".\n\n" +
      "አሁን ዓመቱ " + now.getFullYear() + " ነው።";
  } else if (
    (hasWord(questionText, ["month"]) ||
      questionText.includes("ወር")) &&
    !isEthiopianDateQuestion(questionText)
  ) {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    reply =
      "The current month is " + months[now.getMonth()] + ".\n\n" +
      "ወሩ " + months[now.getMonth()] + " ነው።";
  } else if (
    (hasWord(questionText, ["date", "today", "day"]) ||
      questionText.includes("ዛሬ") ||
      questionText.includes("ቀን")) &&
    !isEthiopianDateQuestion(questionText)
  ) {
    const englishDays = [
      "Sunday", "Monday", "Tuesday", "Wednesday",
      "Thursday", "Friday", "Saturday"
    ];

    const amharicDays = [
      "እሑድ", "ሰኞ", "ማክሰኞ", "ረቡዕ",
      "ሐሙስ", "አርብ", "ቅዳሜ"
    ];

    reply =
      "Today is " + englishDays[now.getDay()] + ".\n\n" +
      "ዛሬ " + amharicDays[now.getDay()] + " ነው።";
  } else if (
    hasWord(questionText, ["ethiopia"]) ||
    questionText.includes("ኢትዮጵያ")
  ) {
    reply =
      "Ethiopia is a country in East Africa. Its capital is Addis Ababa.\n\n" +
      "ኢትዮጵያ በምሥራቅ አፍሪካ ያለች ሀገር ናት። ዋና ከተማዋ አዲስ አበባ ናት።";
  } else if (
    hasWord(questionText, ["kenya"]) ||
    questionText.includes("ኬንያ")
  ) {
    reply =
      "Kenya is a country in East Africa. Its capital is Nairobi.\n\n" +
      "ኬንያ በምሥራቅ አፍሪካ ያለች ሀገር ናት። ዋና ከተማዋ ናይሮቢ ነው።";
  } else if (
    hasWord(questionText, ["addis"]) ||
    questionText.includes("አዲስ አበባ")
  ) {
    reply =
      "Addis Ababa is the capital and largest city of Ethiopia.\n\n" +
      "አዲስ አበባ የኢትዮጵያ ዋና ከተማ እና ትልቁ ከተማ ናት።";
  } else if (
    hasWord(questionText, ["how are you"]) ||
    questionText.includes("እንዴት ነህ") ||
    questionText.includes("እንዴት ነሽ") ||
    questionText.includes("እንዴት ኖት") ||
    questionText.includes("እንዴት ነዎት")
  ) {
    reply =
      "I am doing well, thank you for asking! How can I help you today?\n\n" +
      "ደህና ነኝ፣ ስለጠየቁኝ አመሰግናለሁ! ዛሬ በምን ልርዳዎት?";
  } else if (
    hasWord(questionText, ["your name", "who are you"]) ||
    questionText.includes("ስምህ") ||
    questionText.includes("ስምሽ") ||
    questionText.includes("ማን ነህ") ||
    questionText.includes("ማን ነሽ")
  ) {
    reply =
      "I am the Multilingual Learning Assistant. I answer questions in English and Amharic and can read answers aloud.\n\n" +
      "እኔ የመማሪያ ረዳት ነኝ። በእንግሊዝኛ እና በአማርኛ ጥያቄዎችን እመልሳለሁ፣ መልሶችንም በድምፅ አነባለሁ።";
  } else if (
    hasWord(questionText, ["help"]) ||
    questionText.includes("እርዳኝ") ||
    questionText.includes("እርዳታ")
  ) {
    reply =
      "You can ask about greetings, time, date, Ethiopian date, math, Ethiopia, accessibility, and more.\n\n" +
      "ስለ ሰላምታ፣ ሰዓት፣ ቀን፣ የኢትዮጵያ ቀን፣ ሂሳብ፣ ኢትዮጵያ እና ተደራሽነት መጠየቅ ይችላሉ።";
  } else if (isEthiopianDateQuestion(questionText)) {
    const ethiopianDate = toEthiopianDate(now);

    reply =
      "Today in the Ethiopian calendar is " +
      ethiopianDate.monthEn + " " +
      ethiopianDate.day + ", " +
      ethiopianDate.year + ".\n\n" +
      "ዛሬ በኢትዮጵያ ዘመን አቆጣጠር " +
      ethiopianDate.monthAm + " " +
      ethiopianDate.day + " ቀን " +
      ethiopianDate.year + " ዓ.ም. ነው።";
  } else if (isMathQuestion(questionText)) {
    const result = solveMath(questionText);

    reply = result === null
      ? ""
      : "The answer is " + result + ".\n\nመልሱ " + result + " ነው።";
  } else if (
    hasWord(questionText, ["visual"]) ||
    questionText.includes("ዕይታ")
  ) {
    reply =
      "Visual support includes Read Aloud, High Contrast, and text size controls.\n\n" +
      "የዕይታ ድጋፍ የድምፅ ንባብ፣ ከፍተኛ ንፅፅር እና የጽሑፍ መጠን ማስተካከል ያካትታል።";
  } else if (
    hasWord(questionText, ["hearing"]) ||
    questionText.includes("መስማት")
  ) {
    reply =
      "Hearing support provides clear written answers in Amharic and English.\n\n" +
      "የመስማት ድጋፍ በአማርኛ እና በእንግሊዝኛ ግልጽ ጽሑፍ ይሰጣል።";
  } else if (
    hasWord(questionText, ["mobility"]) ||
    questionText.includes("እንቅስቃሴ")
  ) {
    reply =
      "Mobility support includes large buttons and voice input.\n\n" +
      "የእንቅስቃሴ ድጋፍ ትላልቅ ቁልፎች እና የድምፅ ግብዓት ያካትታል።";
  } else if (
    hasWord(questionText, [
      "learn", "learning", "hackathon", "project"
    ]) ||
    questionText.includes("መማር") ||
    questionText.includes("ሃክአቶን")
  ) {
    reply =
      "This Multilingual Learning Assistant was created for the Accessibility Hackathon 2026.\n\n" +
      "ይህ የመማሪያ ረዳት ለተደራሽነት ሃክአቶን 2026 የተሰራ ነው።";
  }

  return reply || null;
}

async function fetchJson(url, timeout = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function splitForSpeech(text, maxLength = 180) {
  const parts = text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[።፤፥፣፡?!.,;:])\s*/);

  const chunks = [];
  let current = "";

  parts.forEach(part => {
    if ((current + " " + part).trim().length <= maxLength) {
      current = (current + " " + part).trim();
      return;
    }

    if (current) {
      chunks.push(current);
    }

    if (part.length <= maxLength) {
      current = part;
      return;
    }

    current = "";

    part.split(" ").forEach(word => {
      if ((current + " " + word).trim().length > maxLength) {
        if (current) {
          chunks.push(current);
        }

        current = word;
      } else {
        current = (current + " " + word).trim();
      }
    });
  });

  if (current) {
    chunks.push(current);
  }

  return chunks.filter(Boolean);
}

async function translateText(text, from, to) {
  if (!text.trim()) {
    return "";
  }

  try {
    const url =
      "https://translate.googleapis.com/translate_a/single?client=gtx&dt=t" +
      "&sl=" + from +
      "&tl=" + to +
      "&q=" + encodeURIComponent(text);

    const data = await fetchJson(url);
    const translated = data[0].map(part => part[0]).join("");

    if (translated.trim()) {
      return translated;
    }
  } catch (error) {
    console.warn("Google Translate failed:", error);
  }

  const sourceLanguage = from === "auto"
    ? ETHIOPIC_RE.test(text) ? "am" : "en"
    : from;

  const parts = splitForSpeech(text, 450);
  const results = [];

  for (const part of parts) {
    const url =
      "https://api.mymemory.translated.net/get?q=" +
      encodeURIComponent(part) +
      "&langpair=" + sourceLanguage + "|" + to;

    const data = await fetchJson(url);
    results.push(data.responseData.translatedText);
  }

  return results.join(" ");
}

function cleanEnglishSummary(text) {
  return text
    .replace(/\([^)]*[\u1200-\u137F][^)]*\)/g, "")
    .replace(/[\u1200-\u137F]+/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;])/g, "$1")
    .trim();
}

function firstSentences(text, count = 2) {
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g);

  return sentences
    ? sentences.slice(0, count).join("").trim()
    : text;
}

async function searchWikipedia(query) {
  const searchUrl =
    "https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=1&srsearch=" +
    encodeURIComponent(query);

  const searchData = await fetchJson(searchUrl);
  const result = searchData.query?.search?.[0];

  if (!result) {
    return null;
  }

  const summaryUrl =
    "https://en.wikipedia.org/api/rest_v1/page/summary/" +
    encodeURIComponent(result.title.replace(/ /g, "_"));

  const summary = await fetchJson(summaryUrl);

  if (!summary.extract) {
    return null;
  }

  return {
    title: summary.title,
    text: firstSentences(cleanEnglishSummary(summary.extract), 2)
  };
}

async function getOnlineAnswer(question) {
  const cacheKey = question.toLowerCase();

  if (answerCache[cacheKey]) {
    return answerCache[cacheKey];
  }

  const isAmharic = ETHIOPIC_RE.test(question);
  let englishQuestion = question;

  if (isAmharic) {
    englishQuestion = await translateText(question, "am", "en");
  }

  const result = await searchWikipedia(englishQuestion);

  if (!result) {
    throw new Error("No result");
  }

  let amharicTranslation = "";

  try {
    amharicTranslation = await translateText(result.text, "en", "am");
  } catch (error) {
    amharicTranslation = "(የአማርኛ ትርጉም አሁን አልተገኘም።)";
  }

  const answer =
    result.text + "\n\n" + amharicTranslation +
    "\n\n📚 Source / ምንጭ: Wikipedia – " + result.title;

  answerCache[cacheKey] = answer;
  saveAnswer(question, answer);

  return answer;
}

async function getAnswer() {
  const question = questionInput.value.trim();

  if (!question) {
    showAnswer(getText("noQuestion"));
    return;
  }

  stopAllSpeech();

  const localAnswer = getLocalAnswer(question);

  if (localAnswer) {
    showAnswer(localAnswer);
    return;
  }

  const savedAnswer = getSavedAnswer(question);

  if (savedAnswer) {
    showAnswer(savedAnswer);
    return;
  }

  if (!isOnline()) {
    showAnswer(OFFLINE_MESSAGE());
    return;
  }

  showAnswer(getText("searching"));

  if (getAnswerBtn) {
    getAnswerBtn.disabled = true;
  }

  try {
    const onlineAnswer = await getOnlineAnswer(question);
    showAnswer(onlineAnswer);
  } catch (error) {
    console.warn("Online answer failed:", error);

    if (
      !isOnline() ||
      error.name === "AbortError" ||
      error instanceof TypeError
    ) {
      showAnswer(OFFLINE_MESSAGE());
    } else {
      showAnswer(getText("answerFailed"));
    }
  } finally {
    if (getAnswerBtn) {
      getAnswerBtn.disabled = false;
    }
  }
}

function clipKey(text) {
  return text.replace(/\s+/g, " ").trim();
}

function findClip(text) {
  return CLIPS[clipKey(text)] || null;
}

async function playClip(file) {
  if (!clipUrls[file]) {
    const response = await fetch(file);

    if (!response.ok) {
      throw new Error("Clip missing");
    }

    clipUrls[file] = URL.createObjectURL(await response.blob());
  }

  if (stopRequested) {
    return;
  }

  return new Promise((resolve, reject) => {
    onlinePlayer.onended = resolve;
    onlinePlayer.onerror = () => reject("Clip failed");

    onlinePlayer.src = clipUrls[file];
    onlinePlayer.playbackRate = 1;
    onlinePlayer.play().catch(reject);
  });
}

function pickEnglishVoices(voices) {
  return voices
    .filter(voice => voice.lang.toLowerCase().startsWith("en"))
    .sort((first, second) => {
      return getEnglishVoiceScore(first) - getEnglishVoiceScore(second);
    });
}

function getEnglishVoiceScore(voice) {
  let score = 100;
  const index = SOFT_MALE_EN.findIndex(
    name => voice.name.includes(name)
  );

  if (index !== -1) {
    score = index;
  }

  if (!isOnline() && !voice.localService) {
    score += 1000;
  }

  if (/natural|neural|online/i.test(voice.name) && isOnline()) {
    score -= 0.5;
  }

  return score;
}

async function speakAnswer() {
  const text = answerBox.value;

  if (!text) {
    showVoiceStatus(getText("noAnswer"), "warn");
    return;
  }

  stopAllSpeech();
  stopRequested = false;
  isSpeaking = true;

  setSpeakButton(true);

  const languageCode =
    VOICE_LANGUAGE_CODES[readAloudLanguage] || "en-US";

  const languageKey = languageCode.slice(0, 2);

  try {
    const clip = findClip(text);

    if (clip) {
      try {
        await playClip(clip);
        return;
      } catch (error) {
        if (stopRequested) return;
        console.warn("Recorded clip failed:", error);
      }
    }

    const voices = await getVoices();

    const matchingVoices = voices.filter(voice => {
      return voice.lang.toLowerCase().startsWith(languageKey);
    });

    if (matchingVoices.length) {
      try {
        await speakLocalVoice(
          text,
          matchingVoices[0],
          languageCode,
          0.95
        );

        return;
      } catch (error) {
        if (stopRequested) return;
        console.warn("Device voice failed:", error);
      }
    }

    await speakOnline(text, languageKey);
  } catch (error) {
    console.warn("Read aloud failed:", error);

    if (!stopRequested) {
      showVoiceStatus(getText("voiceUnavailable"), "warn");
    }
  } finally {
    isSpeaking = false;
    setSpeakButton(false);
  }
}

async function speakOnline(text, language) {
  stopRequested = false;

  const urls = [
    chunk =>
      "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=" +
      language + "&q=" + encodeURIComponent(chunk),

    chunk =>
      "https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=" +
      language + "&q=" + encodeURIComponent(chunk)
  ];

  for (const chunk of splitForSpeech(text)) {
    if (stopRequested) {
      return;
    }

    let succeeded = false;
    let lastError = null;

    for (const createUrl of urls) {
      try {
        await playAudioUrl(createUrl(chunk));
        succeeded = true;
        break;
      } catch (error) {
        lastError = error;

        if (stopRequested) {
          return;
        }
      }
    }

    if (!succeeded) {
      throw lastError;
    }
  }
}

function playAudioUrl(url) {
  return new Promise((resolve, reject) => {
    onlinePlayer.onended = resolve;
    onlinePlayer.onerror = () => reject("Audio failed");

    onlinePlayer.src = url;
    onlinePlayer.play().catch(reject);
  });
}

function speakLocalVoice(text, voice, language, rate, pitch = 1) {
  return new Promise((resolve, reject) => {
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = language;
    utterance.rate = rate;
    utterance.pitch = pitch;

    let started = false;

    utterance.onstart = () => {
      started = true;
    };

    utterance.onend = resolve;
    utterance.onerror = error => reject(error.error || "Speech error");

    speechSynthesis.speak(utterance);

    setTimeout(() => {
      if (!started && !stopRequested) {
        speechSynthesis.cancel();
        reject("Voice did not start");
      }
    }, 4000);
  });
}

function setSpeakButton(playing) {
  if (!speakAnswerBtn) return;

  if (!speakAnswerBtn.dataset.label) {
    speakAnswerBtn.dataset.label = getText("readAnswer");
  }

  speakAnswerBtn.textContent = playing
    ? getText("stop")
    : speakAnswerBtn.dataset.label;

  speakAnswerBtn.setAttribute(
    "aria-pressed",
    playing ? "true" : "false"
  );
}

function stopAllSpeech() {
  stopRequested = true;
  isSpeaking = false;

  try {
    if (window.speechSynthesis) {
      speechSynthesis.cancel();
    }
  } catch (error) {}

  onlinePlayer.pause();
  onlinePlayer.removeAttribute("src");
  onlinePlayer.load();

  setSpeakButton(false);
}

function clearAll() {
  if (questionInput) {
    questionInput.value = "";
  }

  if (answerBox) {
    answerBox.value = "";
  }

  stopAllSpeech();
}

async function copyAnswer() {
  if (!answerBox?.value) {
    return;
  }

  try {
    await navigator.clipboard.writeText(answerBox.value);
    showVoiceStatus(getText("copied"), "ok");
  } catch (error) {
    answerBox.select();
    document.execCommand("copy");
    showVoiceStatus(getText("copied"), "ok");
  }
}

function looksLikeAmharic(text, confidence) {
  const ethiopicLetters = (
    text.match(/[\u1200-\u137F]/g) || []
  ).length;

  const latinLetters = (text.match(/[A-Za-z]/g) || []).length;

  if (ethiopicLetters === 0) {
    return false;
  }

  if (latinLetters > ethiopicLetters) {
    return false;
  }

  if (confidence > 0 && confidence < 0.35) {
    return false;
  }

  return true;
}

function looksLikeEnglish(text, confidence, alternatives = []) {
  if (
    ETHIOPIC_RE.test(text) ||
    alternatives.some(alternative => ETHIOPIC_RE.test(alternative))
  ) {
    return false;
  }

  const words = text
    .toLowerCase()
    .replace(/[^a-z'\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) {
    return false;
  }

  const amharicRomanHits = words.filter(word => {
    return AM_ROMAN.includes(word);
  }).length;

  if (
    amharicRomanHits >= 1 &&
    amharicRomanHits >= words.length / 3
  ) {
    return false;
  }

  if (confidence > 0 && confidence < 0.45) {
    return false;
  }

  const knownWords = words.filter(word => {
    return COMMON_EN.has(word.replace(/'s$/, ""));
  }).length;

  const knownRatio = knownWords / words.length;

  if (words.length >= 4 && knownRatio < 0.25) {
    return false;
  }

  return true;
}

async function speakWarning(isAmharicMode) {
  setTimeout(async () => {
    try {
      if (isAmharicMode) {
        await speakOnline(
          "ይህ ቁልፍ ለአማርኛ ብቻ ነው። እባክዎ በአማርኛ ይናገሩ።",
          "am"
        );
      } else if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(
          "This button is for English only. Please speak in English."
        );

        utterance.lang = "en-US";
        utterance.rate = 0.95;

        speechSynthesis.speak(utterance);
      }
    } catch (error) {}
  }, 400);
}

function addToQuestion(text) {
  const element = questionInput;
  const oldValue = element.value;

  const isActive = document.activeElement === element;

  const startPosition =
    isActive && typeof element.selectionStart === "number"
      ? element.selectionStart
      : oldValue.length;

  const endPosition =
    isActive && typeof element.selectionEnd === "number"
      ? element.selectionEnd
      : startPosition;

  const before = oldValue.slice(0, startPosition);
  const after = oldValue.slice(endPosition);

  const spaceBefore = before && !/\s$/.test(before) ? " " : "";
  const spaceAfter = after && !/^\s/.test(after) ? " " : "";

  element.value = before + spaceBefore + text + spaceAfter + after;

  const caretPosition = (before + spaceBefore + text).length;

  try {
    element.setSelectionRange(caretPosition, caretPosition);
  } catch (error) {}

  element.dispatchEvent(
    new Event("input", { bubbles: true })
  );
}

async function getOnDeviceStatus(Recognizer, language) {
  if (typeof Recognizer.available !== "function") {
    return "unsupported";
  }

  try {
    return await Recognizer.available({
      langs: [language],
      processLocally: true
    });
  } catch (error) {
    return "unsupported";
  }
}

async function prepareOfflineVoiceTyping() {
  const Recognizer =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (
    !Recognizer ||
    typeof Recognizer.install !== "function" ||
    !isOnline()
  ) {
    return;
  }

  for (const language of ["en-US", "am-ET"]) {
    const status = await getOnDeviceStatus(Recognizer, language);

    if (status === "downloadable") {
      try {
        await Recognizer.install({
          langs: [language],
          processLocally: true
        });
      } catch (error) {}
    }
  }
}

async function startRecognizer(
  recognizer,
  Recognizer,
  language,
  isAmharicMode,
  button,
  originalLabel
) {
  const status = await getOnDeviceStatus(Recognizer, language);

  if (status === "available") {
    recognizer.processLocally = true;
    recognizer._wentLocal = true;
  } else if (!isOnline()) {
    activeRecognizer = null;
    button.textContent = originalLabel;
    button.setAttribute("aria-pressed", "false");

    playWarnBeep();

    showVoiceStatus(
      isAmharicMode
        ? "📶 የአማርኛ ድምፅ ግብዓት ያለ ኢንተርኔት አይሰራም። እባክዎ ይጻፉ ወይም ኢንተርኔት ያገናኙ።"
        : "📶 Offline voice input is not available on this device. Please type your question, or connect to the internet and try again.",
      "warn"
    );

    return;
  }

  recognizer.start();

  if (status === "downloadable" && isOnline()) {
    prepareOfflineVoiceTyping();
  }
}

function startVoice(language, button) {
  const Recognizer =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!Recognizer) {
    showVoiceStatus(getText("microphoneUnsupported"), "warn");
    return;
  }

  if (activeRecognizer) {
    activeRecognizer.abort();
    return;
  }

  stopAllSpeech();

  const isAmharicMode = language === "am-ET";
  const recognizer = new Recognizer();

  recognizer.lang = language;
  recognizer.interimResults = false;
  recognizer.maxAlternatives = 3;

  activeRecognizer = recognizer;

  const originalLabel = button.dataset.label || button.textContent;
  button.dataset.label = originalLabel;

  button.textContent = getText("listening");
  button.setAttribute("aria-pressed", "true");

  showVoiceStatus(
    isAmharicMode
      ? "🎤 በአማርኛ ይናገሩ..."
      : "🎤 Speak in English...",
    "info"
  );

  playBeep();

  recognizer.onresult = event => {
    const bestResult = event.results[0][0];
    const text = bestResult.transcript.trim();

    const confidence =
      typeof bestResult.confidence === "number"
        ? bestResult.confidence
        : 0;

    const alternatives = Array.from(event.results[0]).map(
      alternative => alternative.transcript
    );

    const wrongLanguage = isAmharicMode
      ? !looksLikeAmharic(text, confidence)
      : !looksLikeEnglish(text, confidence, alternatives);

    if (wrongLanguage) {
      playWarnBeep();

      showVoiceStatus(
        isAmharicMode
          ? getText("amharicOnly")
          : getText("englishOnly"),
        "warn"
      );

      speakWarning(isAmharicMode);
      return;
    }

    addToQuestion(text);
    showVoiceStatus(getText("recorded"), "ok");
  };

  recognizer.onerror = event => {
    const error = event.error;

    if (error === "aborted") {
      showVoiceStatus(getText("stoppedListening"), "info");
    } else if (error === "no-speech") {
      showVoiceStatus(getText("noSpeech"), "warn");
    } else if (
      error === "not-allowed" ||
      error === "service-not-allowed"
    ) {
      showVoiceStatus(getText("microphoneDenied"), "warn");
    } else if (
      error === "network" ||
      (!isOnline() && error === "language-not-supported")
    ) {
      showVoiceStatus(
        isAmharicMode
          ? "📶 የአማርኛ ድምፅ ግብዓት ያለ ኢንተርኔት አይሰራም።"
          : "📶 Offline voice input is not available on this device. Please type your question, or connect to the internet and try again.",
        "warn"
      );
    } else if (error === "language-not-supported") {
      showVoiceStatus(getText("languageUnsupported"), "warn");
    } else {
      showVoiceStatus(getText("tryAgain"), "warn");
    }
  };

  recognizer.onend = () => {
    activeRecognizer = null;
    button.textContent = originalLabel;
    button.setAttribute("aria-pressed", "false");
  };

  try {
    startRecognizer(
      recognizer,
      Recognizer,
      language,
      isAmharicMode,
      button,
      originalLabel
    ).catch(() => {
      activeRecognizer = null;
      button.textContent = originalLabel;
      button.setAttribute("aria-pressed", "false");

      showVoiceStatus(getText("tryAgain"), "warn");
    });
  } catch (error) {
    activeRecognizer = null;
    button.textContent = originalLabel;

    showVoiceStatus(getText("tryAgain"), "warn");
  }
}

if (localStorage.getItem("highContrast") === "true") {
  document.body.classList.add("high-contrast");

  if (contrastBtn) {
    contrastBtn.setAttribute("aria-pressed", "true");
  }
}

if (getAnswerBtn) {
  getAnswerBtn.addEventListener("click", getAnswer);
}

if (speakAnswerBtn) {
  speakAnswerBtn.addEventListener("click", () => {
    if (isSpeaking) {
      stopAllSpeech();
      showVoiceStatus(getText("speechStopped"), "info");
      return;
    }

    speakAnswer();
  });
}

if (contrastBtn) {
  contrastBtn.addEventListener("click", () => {
    const enabled = document.body.classList.toggle("high-contrast");

    contrastBtn.setAttribute("aria-pressed", enabled);
    localStorage.setItem("highContrast", enabled);
  });
}

if (clearBtn) {
  clearBtn.addEventListener("click", clearAll);
}

if (copyBtn) {
  copyBtn.addEventListener("click", copyAnswer);
}

if (voiceAmharicBtn) {
  voiceAmharicBtn.addEventListener("click", () => {
    startVoice("am-ET", voiceAmharicBtn);
  });
}

if (voiceEnglishBtn) {
  voiceEnglishBtn.addEventListener("click", () => {
    startVoice("en-US", voiceEnglishBtn);
  });
}

if (fontSmall) {
  fontSmall.addEventListener("click", () => changeFontSize(-0.08));
}

if (fontNormal) {
  fontNormal.addEventListener("click", () => changeFontSize(0, true));
}

if (fontLarge) {
  fontLarge.addEventListener("click", () => changeFontSize(0.08));
}

if (languageSelect) {
  languageSelect.value = currentLanguage;

  languageSelect.addEventListener("change", () => {
    applyLanguage(languageSelect.value);

    readAloudLanguage = languageSelect.value;
    localStorage.setItem("readAloudLanguage", readAloudLanguage);

    if (voiceLanguageSelect) {
      voiceLanguageSelect.value = readAloudLanguage;
    }

    showVoiceStatus(getText("languageChanged"), "info");
  });
}

if (voiceLanguageSelect) {
  voiceLanguageSelect.value = readAloudLanguage;

  voiceLanguageSelect.addEventListener("change", () => {
    readAloudLanguage = voiceLanguageSelect.value;
    localStorage.setItem("readAloudLanguage", readAloudLanguage);

    showVoiceStatus(getText("voiceChanged"), "info");
  });
}

document.querySelectorAll(".suggest").forEach(button => {
  button.addEventListener("click", () => {
    questionInput.value = button.dataset.q;
    questionInput.focus();
  });
});

fetch("audio/manifest.json")
  .then(response => response.json())
  .then(manifest => {
    CLIPS = manifest;
  })
  .catch(() => {});

window.addEventListener("online", () => updateConnectionBadge(true));
window.addEventListener("offline", () => updateConnectionBadge(true));

if (document.readyState !== "loading") {
  setTimeout(() => updateConnectionBadge(false), 0);
} else {
  document.addEventListener("DOMContentLoaded", () => {
    updateConnectionBadge(false);
  });
}

applyLanguage(currentLanguage);

if (
  "serviceWorker" in navigator &&
  location.protocol.startsWith("http")
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .catch(error =>
        console.warn("Service worker failed:", error)
      );
  });
}