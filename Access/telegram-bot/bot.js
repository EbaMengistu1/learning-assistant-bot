const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");
const express = require("express");

console.log("BOT VERSION: v20 FINAL POWERFUL BILINGUAL TRACK 3 ASSISTANT");

const TOKEN = process.env.BOT_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const AT_USERNAME = process.env.AT_USERNAME;
const AT_API_KEY = process.env.AT_API_KEY;
const AT_SENDER_ID = process.env.AT_SENDER_ID;

if (!TOKEN) {
  console.error("BOT_TOKEN is missing. Add it in Railway Variables.");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, {
  polling: true
});

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

let COURSE_DATA = {
  lessons: []
};

try {
  COURSE_DATA = JSON.parse(
    fs.readFileSync(path.join(__dirname, "course-data.json"), "utf8")
  );

  console.log("Course lessons loaded:", COURSE_DATA.lessons.length);
} catch (error) {
  console.error("Could not load course-data.json:", error.message);
}

const botUsers = new Map();
const userPhones = new Map();
const userLessons = new Map();
const userProgress = new Map();
const userQuiz = new Map();
const userState = new Map();
const userLanguage = new Map();
const simpleMode = new Map();
const smsWaiting = new Map();

const stats = {
  totalQuestions: 0,
  courseQuestions: 0,
  aiQuestions: 0,
  helpRequests: 0,
  accommodationRequests: 0,
  screenShareRequests: 0,
  quizCompletions: 0,
  smsNotifications: 0,
  telegramAnnouncements: 0,
  smsAnnouncements: 0,
  individualTelegramMessages: 0,
  individualSmsMessages: 0,
  topicCounts: {}
};

const quizzes = {
  downloading: [
    {
      question: "What does downloading mean?",
      options: [
        "Sending a file to the internet",
        "Saving a file from the internet to your device",
        "Deleting a file"
      ],
      correct: 1
    },
    {
      question: "After downloading a file, can you usually open it offline?",
      options: [
        "Yes",
        "No"
      ],
      correct: 0
    },
    {
      question: "Which one can you download?",
      options: [
        "A PDF",
        "A photo",
        "A video",
        "All of the above"
      ],
      correct: 3
    }
  ],
  internet: [
    {
      question: "What is the internet?",
      options: [
        "A global network of connected computers",
        "A type of computer",
        "A mobile phone",
        "A website"
      ],
      correct: 0
    },
    {
      question: "What do you need to use the internet?",
      options: [
        "An internet connection",
        "A printer",
        "A keyboard only",
        "A radio"
      ],
      correct: 0
    },
    {
      question: "Which one is a web browser?",
      options: [
        "Google Chrome",
        "Microsoft Word",
        "WhatsApp",
        "Calculator"
      ],
      correct: 0
    }
  ],
  safety: [
    {
      question: "What should you do if someone asks for your password?",
      options: [
        "Share it with them",
        "Never share your password",
        "Send it by SMS",
        "Post it online"
      ],
      correct: 1
    },
    {
      question: "Which password is strongest?",
      options: [
        "123456",
        "password",
        "MyName2026!",
        "111111"
      ],
      correct: 2
    },
    {
      question: "What should you do if a message looks suspicious?",
      options: [
        "Click the link quickly",
        "Send money",
        "Do not click and report it",
        "Share your bank details"
      ],
      correct: 2
    }
  ],
  email: [
    {
      question: "What is an email address?",
      options: [
        "A place to send and receive messages online",
        "A phone number",
        "A type of computer",
        "A website"
      ],
      correct: 0
    },
    {
      question: "Which one looks like an email address?",
      options: [
        "name@example.com",
        "0712345678",
        "www.google.com",
        "Addis Ababa"
      ],
      correct: 0
    },
    {
      question: "What should you check before opening an email link?",
      options: [
        "Nothing",
        "If the sender and link are safe",
        "Only the color",
        "Only the time"
      ],
      correct: 1
    }
  ]
};

const jobs = [
  {
    title: "Data Entry Assistant",
    organization: "Local Organization",
    location: "Addis Ababa",
    type: "Full-time",
    deadline: "2026-11-30",
    link: "https://example.com/apply-data-entry"
  },
  {
    title: "Online English Tutor",
    organization: "Learning Center",
    location: "Remote",
    type: "Part-time",
    deadline: "2026-12-05",
    link: "https://example.com/apply-english-tutor"
  },
  {
    title: "Customer Service Representative",
    organization: "Telecom Company",
    location: "Addis Ababa",
    type: "Full-time",
    deadline: "2026-12-10",
    link: "https://example.com/apply-customer-service"
  },
  {
    title: "Amharic-English Translator",
    organization: "Translation Agency",
    location: "Remote",
    type: "Freelance",
    deadline: "2026-12-15",
    link: "https://example.com/apply-translator"
  },
  {
    title: "Graphic Designer",
    organization: "Creative Agency",
    location: "Addis Ababa",
    type: "Full-time",
    deadline: "2026-12-20",
    link: "https://example.com/apply-graphic-designer"
  },
  {
    title: "Social Media Assistant",
    organization: "Digital Marketing Company",
    location: "Remote",
    type: "Part-time",
    deadline: "2026-12-25",
    link: "https://example.com/apply-social-media"
  },
  {
    title: "Computer Teacher",
    organization: "Community Training Center",
    location: "Addis Ababa",
    type: "Part-time",
    deadline: "2026-12-30",
    link: "https://example.com/apply-computer-teacher"
  },
  {
    title: "Data Entry Assistant",
    organization: "NGO",
    location: "Remote",
    type: "Remote",
    deadline: "2027-01-05",
    link: "https://example.com/apply-remote-data-entry"
  }
];

function isAdmin(chatId) {
  return String(chatId) === String(ADMIN_CHAT_ID);
}

function isAmharicQuestion(text) {
  const amharicLetters = text.match(/[\u1200-\u137F]/g);
  return Boolean(amharicLetters && amharicLetters.length > 0);
}

function normalizeText(text) {
  return String(text)
    .toLowerCase()
    .replace(/[?؟!.።,،]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findCourseAnswer(question) {
  const questionText = normalizeText(question);
  const words = questionText.split(" ");

  let bestLesson = null;
  let bestScore = 0;

  COURSE_DATA.lessons.forEach(lesson => {
    let score = 0;

    const keywords = lesson.keywords || [];

    keywords.forEach(keyword => {
      const keywordText = normalizeText(keyword);

      if (!keywordText) {
        return;
      }

      const keywordWords = keywordText.split(" ");

      if (keywordWords.every(word => words.includes(word))) {
        score += 2;
      }
    });

    const lessonTitle = normalizeText(lesson.title || "");
    const titleWords = lessonTitle.split(" ");

    if (
      titleWords.length > 0 &&
      titleWords.every(word => words.includes(word))
    ) {
      score += 3;
    }

    if (score > bestScore) {
      bestScore = score;
      bestLesson = lesson;
    }
  });

  return bestScore > 0 ? bestLesson : null;
}

function findJobAnswer(question) {
  const q = normalizeText(question);

  const jobWords = [
    "job",
    "jobs",
    "work",
    "career",
    "hire",
    "hiring",
    "employment",
    "vacancy",
    "ሥራ",
    "ስራ",
    "ቅጥር",
    "ሥራ ለመመልከት",
    "ሥራ ማግኘት",
    "የሥራ ማስታወቂያ"
  ];

  const hasJobWord = jobWords.some(word => q.includes(word));

  if (!hasJobWord) {
    return null;
  }

  if (q.includes("apply") || q.includes("ማመልከት") || q.includes("ለመመልከት")) {
    return {
      en: "To apply for a job, read the job details, prepare your CV, and follow the application link before the deadline.",
      am: "ለሥራ ለመመልከት፣ የሥራ ዝርዝሩን ያንብቡ፣ CV ያዘጋጁ እና ከጊዜ ማብቂያው በፊት የማመልከቻ ሊንኩን ይከተሉ።"
    };
  }

  if (q.includes("cv") || q.includes("resume") || q.includes("ሲቪ")) {
    return {
      en: "A CV is a short document that shows your education, skills, experience, and contact information.",
      am: "CV ማለት ትምህርትዎን፣ ክህሎትዎን፣ ሥራ ልምድዎን እና የመገናኛ መረጃዎን የሚያሳይ አጭር ሰነድ ነው።"
    };
  }

  if (q.includes("interview") || q.includes("ቃለ መጠይቅ")) {
    return {
      en: "For an interview, arrive early, dress cleanly, answer clearly, and ask for support if you need it.",
      am: "ለቃለ መጠይቅ፣ ቀድመው ይውጡ፣ በንጹህ ልብስ ይቆሙ፣ በግልጽ ይመልሱ፣ እና እርዳታ ከፈለጉ ይጠይቁ።"
    };
  }

  return {
    en: "You can see current job alerts by sending /jobs. Tap a job title to see the deadline and application link.",
    am: "የአሁኑን የሥራ ማስታወቂያዎች ለማየት /jobs ይላኩ። ዝርዝሩን እና የማመልከቻ ሊንኩን ለማየት የሥራ ርዕሱን ይንኩ።"
  };
}

function getSource(lesson) {
  const source = lesson.source || {};

  let text = "📚 Source: ";
  text += source.lesson || lesson.title || "Course lesson";

  if (source.section) {
    text += " — " + source.section;
  }

  if (source.url) {
    text += "\n🔗 " + source.url;
  }

  return text;
}

function saveUserProgress(chatId, lessonTitle) {
  let completed = userProgress.get(chatId) || [];

  if (!completed.includes(lessonTitle)) {
    completed.push(lessonTitle);
  }

  userProgress.set(chatId, completed);
}

function getNextLesson(chatId) {
  const completed = userProgress.get(chatId) || [];

  return COURSE_DATA.lessons.find(lesson => {
    return !completed.includes(lesson.title);
  });
}

function sendHelpRequestToAdmin(chatId, question) {
  if (!ADMIN_CHAT_ID) return;

  bot.sendMessage(
    ADMIN_CHAT_ID,
    "🙋 New help request\n\n" +
    "User ID: " + chatId + "\n" +
    "Question: " + question
  );
}

function sendAccommodationRequestToAdmin(chatId, accommodation) {
  if (!ADMIN_CHAT_ID) return;

  bot.sendMessage(
    ADMIN_CHAT_ID,
    "📋 Interview accommodation request\n\n" +
    "User ID: " + chatId + "\n" +
    "Need: " + accommodation
  );
}

function sendScreenShareRequestToAdmin(chatId, meetingLink) {
  if (!ADMIN_CHAT_ID) return;

  bot.sendMessage(
    ADMIN_CHAT_ID,
    "🖥️ Screen-sharing request\n\n" +
    "User ID: " + chatId + "\n" +
    "Meeting link: " + meetingLink
  );
}

function sendQuizQuestion(chatId, quizName, questionIndex) {
  const quiz = quizzes[quizName];
  const question = quiz[questionIndex];

  const buttons = question.options.map((option, index) => {
    return [
      {
        text: option,
        callback_data:
          "quiz_" + quizName + "_" + questionIndex + "_" + index
      }
    ];
  });

  bot.sendMessage(
    chatId,
    "Question " + (questionIndex + 1) + " of " + quiz.length + "\n\n" +
    question.question,
    {
      reply_markup: {
        inline_keyboard: buttons
      }
    }
  );
}

function sendQuizMenu(chatId) {
  bot.sendMessage(
    chatId,
    "📝 Choose a quiz:",

    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "📥 Downloading Quiz",
              callback_data: "start_quiz_downloading"
            }
          ],
          [
            {
              text: "🌐 Internet Quiz",
              callback_data: "start_quiz_internet"
            }
          ],
          [
            {
              text: "🛡️ Online Safety Quiz",
              callback_data: "start_quiz_safety"
            }
          ],
          [
            {
              text: "📧 Email Quiz",
              callback_data: "start_quiz_email"
            }
          ]
        ]
      }
    }
  );
}

function sendLessonMenu(chatId) {
  const lessonButtons = COURSE_DATA.lessons
    .slice(0, 10)
    .map((lesson, index) => {
      return [
        {
          text: "📚 " + lesson.title,
          callback_data: "lesson_" + index
        }
      ];
    });

  bot.sendMessage(
    chatId,
    "📚 Choose a lesson:\n\n" +
    "You can also type your question in Amharic or English.\n\n" +
    "በአማርኛ ወይም በእንግሊዝኛ ጥያቄ መጠየቅ ይችላሉ።",

    {
      reply_markup: {
        inline_keyboard: lessonButtons
      }
    }
  );
}

function sendJobAlerts(chatId) {
  const jobButtons = jobs.map((job, index) => {
    return [
      {
        text: (index + 1) + ". " + job.title,
        callback_data: "job_" + index
      }
    ];
  });

  bot.sendMessage(
    chatId,
    "💼 Job Alerts\n\n" +
    "Tap a job title to see details.\n\n" +
    "ዝርዝር ለማየት የሥራ ርዕሱን ይንኩ።",

    {
      reply_markup: {
        inline_keyboard: jobButtons
      }
    }
  );
}

function sendAccommodationMenu(chatId) {
  userState.set(chatId, "waiting_accommodation");

  bot.sendMessage(
    chatId,
    "📋 Interview Support\n\n" +
    "What accommodation do you need for an interview?\n\n" +
    "1. Extra time\n" +
    "2. Screen reader support\n" +
    "3. Sign language interpreter\n" +
    "4. Quiet interview space\n" +
    "5. Written questions\n" +
    "6. Other\n\n" +
    "Please reply with a number.\n\n" +
    "እባክዎ ቁጥር ይላኩ።"
  );
}

function sendTeacherAnalytics(chatId) {
  let topicText = "No course questions yet.";

  const topics = Object.keys(stats.topicCounts);

  if (topics.length > 0) {
    const sortedTopics = topics.sort((a, b) => {
      return stats.topicCounts[b] - stats.topicCounts[a];
    });

    topicText = sortedTopics
      .slice(0, 5)
      .map(topic => {
        return "• " + topic + ": " + stats.topicCounts[topic];
      })
      .join("\n");
  }

  bot.sendMessage(
    chatId,
    "📊 Teacher Analytics\n\n" +
    "Total questions: " + stats.totalQuestions + "\n" +
    "Course questions: " + stats.courseQuestions + "\n" +
    "AI questions: " + stats.aiQuestions + "\n" +
    "Help requests: " + stats.helpRequests + "\n" +
    "Accommodation requests: " + stats.accommodationRequests + "\n" +
    "Screen-sharing requests: " + stats.screenShareRequests + "\n" +
    "Quiz completions: " + stats.quizCompletions + "\n" +
    "SMS reminders sent: " + stats.smsNotifications + "\n" +
    "Telegram announcements: " + stats.telegramAnnouncements + "\n" +
    "SMS announcements: " + stats.smsAnnouncements + "\n" +
    "Individual Telegram messages: " + stats.individualTelegramMessages + "\n" +
    "Individual SMS messages: " + stats.individualSmsMessages + "\n\n" +
    "Most asked topics:\n" +
    topicText
  );
}

function sendStudentList(chatId) {
  const students = Array.from(botUsers.entries()).filter(
    ([id, user]) => user.role === "student"
  );

  if (students.length === 0) {
    bot.sendMessage(
      chatId,
      "👥 No students have joined yet.\n\n" +
      "Ask students to open the bot and send /start."
    );

    return;
  }

  const studentButtons = students.map(([studentChatId, user]) => {
    const phone = userPhones.get(studentChatId);

    return [
      {
        text:
          "👤 " + (user.firstName || "Student") +
          " | 📞 " + (phone || "No phone"),
        callback_data: "student_" + studentChatId
      }
    ];
  });

  bot.sendMessage(
    chatId,
    "👥 Students\n\n" +
    "Choose a student to contact individually:",

    {
      reply_markup: {
        inline_keyboard: studentButtons
      }
    }
  );
}

async function askGroq(question, language) {
  if (!GROQ_API_KEY) {
    console.error("GROQ_API_KEY is missing in Railway Variables.");
    return null;
  }

  const cleanKey = GROQ_API_KEY.trim();

  const systemMessage =
    language === "amharic"
      ? "You are a simple learning assistant. Answer in clear, simple Amharic first. Then add a short English translation. Keep the answer helpful, respectful, and easy to understand."
      : "You are a simple learning assistant. Answer in clear, simple English first. If useful, add a short Amharic translation. Keep the answer helpful, respectful, and easy to understand.";

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + cleanKey
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [
          {
            role: "system",
            content: systemMessage
          },
          {
            role: "user",
            content: question
          }
        ],
        temperature: 0.3,
        max_tokens: 600
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    console.error(
      "Groq API error:",
      response.status,
      errorText
    );

    throw new Error(
      "Groq API error: " + response.status + " — " + errorText
    );
  }

  const data = await response.json();

  if (!data.choices || !data.choices[0]) {
    console.error("Groq returned no answer:", data);
    return null;
  }

  return data.choices[0].message.content.trim();
}

async function sendSms(to, message) {
  if (!AT_USERNAME || !AT_API_KEY) {
    console.error("Africa's Talking username or API key is missing.");
    return;
  }

  const username = AT_USERNAME.trim();
  const apiKey = AT_API_KEY.trim();
  const senderId = AT_SENDER_ID ? AT_SENDER_ID.trim() : "";

  const body = new URLSearchParams();
  body.append("username", username);
  body.append("to", to);
  body.append("message", message);

  if (senderId) {
    body.append("from", senderId);
  }

  const response = await fetch(
    "https://api.sandbox.africastalking.com/version1/messaging",
    {
      method: "POST",
      headers: {
        "apiKey": apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
      },
      body: body
    }
  );

  const responseText = await response.text();

  console.log("Africa's Talking status:", response.status);
  console.log("Africa's Talking response:", responseText);

  if (!response.ok) {
    throw new Error("Africa's Talking rejected the request.");
  }
}

app.post("/sms", async (req, res) => {
  const incomingMessage = req.body.text || "";
  const sender = req.body.from || "";

  const lesson = findCourseAnswer(incomingMessage);

  let reply;

  if (lesson) {
    const simple = lesson.simple || {};

    if (isAmharicQuestion(incomingMessage)) {
      reply =
        (simple.am || "") +
        "\n\n🇬🇧 English:\n" +
        (simple.en || "");
    } else {
      reply =
        (simple.en || "") +
        "\n\n🇪🇹 አማርኛ:\n" +
        (simple.am || "");
    }
  } else {
    reply =
      "Sorry, I can answer Internet Basics questions by SMS.\n\n" +
      "For more help, use our Telegram bot.\n\n" +
      "ለበለጠ እርዳታ የቴሌግራም ቦታችንን ይጠቀሙ።";
  }

  console.log("SMS received:", incomingMessage);
  console.log("SMS reply:", reply);

  if (sender && reply) {
    try {
      await sendSms(sender, reply);
    } catch (error) {
      console.error("SMS send failed:", error.message);
    }
  }

  res.status(200).send("OK");
});

bot.on("callback_query", async callbackQuery => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data === "student_learning") {
    sendLessonMenu(chatId);

    bot.answerCallbackQuery(callbackQuery.id);

    return;
  }

  if (data === "teacher_panel") {
    if (!isAdmin(chatId)) {
      bot.sendMessage(
        chatId,
        "❌ Only teachers and admins can open this panel."
      );

      bot.answerCallbackQuery(callbackQuery.id);

      return;
    }

    bot.sendMessage(
      chatId,
      "👩‍🏫 Teacher Admin Panel\n\n" +
      "Choose an action:",

      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "👥 View Students",
                callback_data: "view_students"
              }
            ],
            [
              {
                text: "📢 Send Telegram Announcement",
                callback_data: "start_telegram_announcement"
              }
            ],
            [
              {
                text: "📩 Send SMS Announcement",
                callback_data: "start_sms_announcement"
              }
            ],
            [
              {
                text: "📊 View Teacher Analytics",
                callback_data: "view_teacher_analytics"
              }
            ]
          ]
        }
      }
    );

    bot.answerCallbackQuery(callbackQuery.id);

    return;
  }

  if (data === "view_students") {
    if (!isAdmin(chatId)) {
      bot.sendMessage(
        chatId,
        "❌ Only teachers and admins can view students."
      );

      bot.answerCallbackQuery(callbackQuery.id);

      return;
    }

    sendStudentList(chatId);

    bot.answerCallbackQuery(callbackQuery.id);

    return;
  }

  if (data.startsWith("student_")) {
    if (!isAdmin(chatId)) {
      bot.sendMessage(
        chatId,
        "❌ Only teachers and admins can message students."
      );

      bot.answerCallbackQuery(callbackQuery.id);

      return;
    }

    const studentChatId = data.replace("student_", "");
    const user = botUsers.get(Number(studentChatId));
    const phone = userPhones.get(Number(studentChatId));

    const name = user ? user.firstName || "Student" : "Student";

    const buttons = [
      [
        {
          text: "🔔 Send Telegram Message",
          callback_data: "message_student_" + studentChatId
        }
      ]
    ];

    if (phone) {
      buttons.push([
        {
          text: "📩 Send SMS Message",
          callback_data: "sms_student_" + studentChatId
        }
      ]);
    }

    bot.sendMessage(
      chatId,
      "👤 Student: " + name + "\n" +
      "Telegram ID: " + studentChatId + "\n" +
      "Phone: " + (phone || "Not saved") + "\n\n" +
      "Choose how you want to contact this student:",

      {
        reply_markup: {
          inline_keyboard: buttons
        }
      }
    );

    bot.answerCallbackQuery(callbackQuery.id);

    return;
  }

  if (data.startsWith("message_student_")) {
    if (!isAdmin(chatId)) {
      bot.sendMessage(
        chatId,
        "❌ Only teachers and admins can message students."
      );

      bot.answerCallbackQuery(callbackQuery.id);

      return;
    }

    const studentChatId = data.replace("message_student_", "");

    userState.set(
      chatId,
      "waiting_individual_telegram_" + studentChatId
    );

    bot.sendMessage(
      chatId,
      "✉️ Please write the Telegram message you want to send to this student.\n\n" +
      "Send /cancel to stop."
    );

    bot.answerCallbackQuery(callbackQuery.id);

    return;
  }

  if (data.startsWith("sms_student_")) {
    if (!isAdmin(chatId)) {
      bot.sendMessage(
        chatId,
        "❌ Only teachers and admins can send SMS messages."
      );

      bot.answerCallbackQuery(callbackQuery.id);

      return;
    }

    const studentChatId = data.replace("sms_student_", "");

    userState.set(
      chatId,
      "waiting_individual_sms_" + studentChatId
    );

    bot.sendMessage(
      chatId,
      "📩 Please write the SMS message you want to send to this student.\n\n" +
      "Send /cancel to stop."
    );

    bot.answerCallbackQuery(callbackQuery.id);

    return;
  }

  if (data === "start_telegram_announcement") {
    if (!isAdmin(chatId)) {
      bot.sendMessage(
        chatId,
        "❌ Only teachers and admins can send announcements."
      );

      bot.answerCallbackQuery(callbackQuery.id);

      return;
    }

    userState.set(chatId, "waiting_announcement");

    bot.sendMessage(
      chatId,
      "📢 Please write the Telegram announcement for all students.\n\n" +
      "Send /cancel to stop."
    );

    bot.answerCallbackQuery(callbackQuery.id);

    return;
  }

  if (data === "start_sms_announcement") {
    if (!isAdmin(chatId)) {
      bot.sendMessage(
        chatId,
        "❌ Only teachers and admins can send SMS announcements."
      );

      bot.answerCallbackQuery(callbackQuery.id);

      return;
    }

    userState.set(chatId, "waiting_sms_announcement");

    bot.sendMessage(
      chatId,
      "📩 Please write the SMS announcement for all saved phone numbers.\n\n" +
      "Send /cancel to stop."
    );

    bot.answerCallbackQuery(callbackQuery.id);

    return;
  }

  if (data === "view_teacher_analytics") {
    if (!isAdmin(chatId)) {
      bot.sendMessage(
        chatId,
        "❌ Only teachers and admins can view analytics."
      );

      bot.answerCallbackQuery(callbackQuery.id);

      return;
    }

    sendTeacherAnalytics(chatId);

    bot.answerCallbackQuery(callbackQuery.id);

    return;
  }

  if (data === "sms_notification") {
    bot.sendMessage(
      chatId,
      "📩 How would you like to receive your learning reminder?",

      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🔔 Telegram Reminder",
                callback_data: "telegram_reminder"
              }
            ],
            [
              {
                text: "📩 SMS Reminder",
                callback_data: "sms_reminder"
              }
            ]
          ]
        }
      }
    );

    bot.answerCallbackQuery(callbackQuery.id);

    return;
  }

  if (data === "telegram_reminder") {
    const nextLesson = getNextLesson(chatId);

    if (nextLesson) {
      bot.sendMessage(
        chatId,
        "📚 Learning reminder\n\n" +
        "Your next lesson is: " + nextLesson.title + "\n\n" +
        "Ask me: What is " + nextLesson.title + "?\n\n" +
        "You can also take a quiz with /quiz."
      );
    } else {
      bot.sendMessage(
        chatId,
        "🎉 Great job! You have completed all available lessons."
      );
    }

    bot.answerCallbackQuery(callbackQuery.id, {
      text: "Telegram reminder sent"
    });

    return;
  }

  if (data === "sms_reminder") {
    smsWaiting.set(chatId, true);

    bot.sendMessage(
      chatId,
      "📩 *SMS Learning Reminder*\n\n" +
      "Please send your phone number in international format:\n\n" +
      "`+251917696254`\n\n" +
      "Or send /stop to cancel.",
      {
        parse_mode: "Markdown",
        reply_markup: {
          force_reply: true
        }
      }
    );

    bot.answerCallbackQuery(callbackQuery.id);

    return;
  }

  if (data === "track3_menu") {
    bot.sendMessage(
      chatId,
      "🎯 Track 3: Accessible Learning and Employment Support\n\n" +
      "Choose what you need:",

      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "📚 Ask a Course Question",
                callback_data: "track3_course_question"
              }
            ],
            [
              {
                text: "🙋 Need a Person / Help",
                callback_data: "track3_need_person"
              }
            ],
            [
              {
                text: "🖥️ Share My Screen",
                callback_data: "track3_share_screen"
              }
            ],
            [
              {
                text: "💼 Job Alerts",
                callback_data: "track3_jobs"
              }
            ],
            [
              {
                text: "📋 Interview Support",
                callback_data: "track3_interview_support"
              }
            ]
          ]
        }
      }
    );

    bot.answerCallbackQuery(callbackQuery.id);

    return;
  }

  if (data === "track3_course_question") {
    sendLessonMenu(chatId);

    bot.answerCallbackQuery(callbackQuery.id);

    return;
  }

  if (data === "track3_need_person") {
    userState.set(chatId, "waiting_help_question");

    bot.sendMessage(
      chatId,
      "🙋 Please write your question or problem.\n\n" +
      "A teacher or support person will receive your request.\n\n" +
      "You do not need to share your screen."
    );

    bot.answerCallbackQuery(callbackQuery.id);

    return;
  }

  if (data === "track3_share_screen") {
    bot.sendMessage(
      chatId,
      "🖥️ Screen sharing is optional.\n\n" +
      "You can choose:",

      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✅ Yes, share my screen",
                callback_data: "share_screen_yes"
              }
            ],
            [
              {
                text: "❌ No, do not share",
                callback_data: "share_screen_no"
              }
            ]
          ]
        }
      }
    );

    bot.answerCallbackQuery(callbackQuery.id);

    return;
  }

  if (data === "share_screen_yes") {
    bot.sendMessage(
      chatId,
      "✅ Thank you for choosing to share your screen.\n\n" +
      "Please send your Google Meet, Zoom, or other meeting link.\n\n" +
      "Example:\n`https://meet.google.com/your-meeting-link`\n\n" +
      "A teacher or support person will join only if you share the link."
    );

    userState.set(chatId, "waiting_screen_link");

    bot.answerCallbackQuery(callbackQuery.id);

    return;
  }

  if (data === "share_screen_no") {
    bot.sendMessage(
      chatId,
      "✅ No problem. You do not need to share your screen.\n\n" +
      "You can still ask questions, request help, take quizzes, and get job alerts."
    );

    bot.answerCallbackQuery(callbackQuery.id);

    return;
  }

  if (data === "track3_jobs") {
    sendJobAlerts(chatId);

    bot.answerCallbackQuery(callbackQuery.id);

    return;
  }

  if (data === "track3_interview_support") {
    sendAccommodationMenu(chatId);

    bot.answerCallbackQuery(callbackQuery.id);

    return;
  }

  if (data === "toggle_simple_mode") {
    const current = simpleMode.get(chatId) || false;
    const next = !current;

    simpleMode.set(chatId, next);

    bot.sendMessage(
      chatId,
      next
        ? "🟢 Simple Mode is ON.\n\nI will give short and easy answers."
        : "🔵 Simple Mode is OFF.\n\nI will give normal answers."
    );

    bot.answerCallbackQuery(callbackQuery.id);

    return;
  }

  if (data.startsWith("lesson_")) {
    const lessonIndex = Number(data.replace("lesson_", ""));
    const lesson = COURSE_DATA.lessons[lessonIndex];

    if (!lesson) {
      bot.sendMessage(chatId, "Lesson not found.");

      bot.answerCallbackQuery(callbackQuery.id);

      return;
    }

    userLessons.set(chatId, lesson);

    const simple = lesson.simple || {};
    const englishSimple = simple.en || "";
    const amharicSimple = simple.am || "";

    const source = getSource(lesson);

    bot.sendMessage(
      chatId,
      "📚 " + lesson.title + "\n\n" +
      "🇬🇧 English:\n" +
      englishSimple +
      "\n\n🇪🇹 አማርኛ:\n" +
      amharicSimple +
      "\n\n" +
      source,

      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✅ Show Full Explanation",
                callback_data: "full_answer"
              }
            ],
            [
              {
                text: "📝 Take Quiz",
                callback_data: "start_quiz_downloading"
              }
            ]
          ]
        }
      }
    );

    bot.answerCallbackQuery(callbackQuery.id);

    return;
  }

  if (data.startsWith("start_quiz_")) {
    const quizName = data.replace("start_quiz_", "");

    if (!quizzes[quizName]) {
      bot.sendMessage(chatId, "Quiz not found.");

      bot.answerCallbackQuery(callbackQuery.id);

      return;
    }

    userQuiz.set(chatId, {
      name: quizName,
      questionIndex: 0,
      score: 0
    });

    sendQuizQuestion(chatId, quizName, 0);

    bot.answerCallbackQuery(callbackQuery.id);

    return;
  }

  if (data === "full_answer") {
    const lesson = userLessons.get(chatId);

    if (!lesson) {
      bot.sendMessage(
        chatId,
        "Please first choose or ask about a lesson."
      );

      bot.answerCallbackQuery(callbackQuery.id);

      return;
    }

    saveUserProgress(chatId, lesson.title);

    const answer = lesson.answer || {};
    const englishFull = answer.en || "";
    const amharicFull = answer.am || "";

    const language = userLanguage.get(chatId) || "english";

    let fullAnswer;

    if (language === "amharic") {
      fullAnswer =
        amharicFull +
        "\n\n🇬🇧 English:\n" +
        englishFull;
    } else {
      fullAnswer =
        englishFull +
        "\n\n🇪🇹 አማርኛ:\n" +
        amharicFull;
    }

    const source = getSource(lesson);

    bot.sendMessage(
      chatId,
      fullAnswer + "\n\n" + source
    );

    bot.answerCallbackQuery(callbackQuery.id, {
      text: "Full answer sent"
    });

    return;
  }

  if (data.startsWith("job_")) {
    const jobIndex = Number(data.replace("job_", ""));
    const job = jobs[jobIndex];

    if (!job) {
      bot.sendMessage(chatId, "Job not found.");

      bot.answerCallbackQuery(callbackQuery.id);

      return;
    }

    bot.sendMessage(
      chatId,
      "💼 " + job.title + "\n\n" +
      "Organization: " + job.organization + "\n" +
      "Location: " + job.location + "\n" +
      "Type: " + job.type + "\n" +
      "Deadline: " + job.deadline + "\n\n" +
      "Apply here:\n" +
      job.link
    );

    bot.answerCallbackQuery(callbackQuery.id);

    return;
  }

  if (data.startsWith("quiz_")) {
    const parts = data.split("_");
    const quizName = parts[1];
    const questionIndex = Number(parts[2]);
    const selectedOption = Number(parts[3]);

    const quiz = quizzes[quizName];
    const question = quiz[questionIndex];

    const userQuizData = userQuiz.get(chatId);

    if (!userQuizData) {
      bot.answerCallbackQuery(callbackQuery.id);

      return;
    }

    if (selectedOption === question.correct) {
      userQuizData.score += 1;

      bot.answerCallbackQuery(callbackQuery.id, {
        text: "✅ Correct!"
      });
    } else {
      bot.answerCallbackQuery(callbackQuery.id, {
        text:
          "❌ Incorrect. Correct answer: " +
          question.options[question.correct]
      });
    }

    const nextQuestion = questionIndex + 1;

    if (nextQuestion < quiz.length) {
      userQuiz.set(chatId, userQuizData);

      sendQuizQuestion(chatId, quizName, nextQuestion);
    } else {
      userQuiz.delete(chatId);

      stats.quizCompletions += 1;

      bot.sendMessage(
        chatId,
        "🎉 Quiz finished!\n\n" +
        "Your score: " + userQuizData.score + " out of " + quiz.length + "\n\n" +
        "Try another quiz with /quiz."
      );
    }
  }
});

bot.on("message", async message => {
  const chatId = message.chat.id;
  const text = message.text;

  if (!text) {
    return;
  }

  const normalText = text.toLowerCase().trim();

  stats.totalQuestions += 1;

  console.log("Received message:", text);

  botUsers.set(chatId, {
    chatId: chatId,
    firstName: message.from.first_name || "Learner",
    username: message.from.username || null,
    role: isAdmin(chatId) ? "teacher" : "student"
  });

  const language = isAmharicQuestion(text) ? "amharic" : "english";
  userLanguage.set(chatId, language);

  // ---------- SMS REMINDER MODE ----------

  if (smsWaiting.get(chatId)) {

    if (
      normalText === "/start" ||
      normalText === "/stop" ||
      normalText === "/cancel"
    ) {
      smsWaiting.delete(chatId);

      if (normalText === "/start") {
        sendStartMenu(chatId, message);
      } else {
        bot.sendMessage(
          chatId,
          "✅ SMS reminder cancelled.\n\nYou can use the bot normally now."
        );
      }

      return;
    }

    const phone = text.trim();

    const phonePattern = /^\+[1-9]\d{7,14}$/;

    if (!phonePattern.test(phone)) {
      bot.sendMessage(
        chatId,
        "❌ Please send a valid international phone number.\n\n" +
        "Example:\n`+251917696254`\n\n" +
        "Or send /stop to cancel.",
        {
          parse_mode: "Markdown",
          reply_markup: {
            force_reply: true
          }
        }
      );

      return;
    }

    smsWaiting.delete(chatId);
    userPhones.set(chatId, phone);

    bot.sendMessage(
      chatId,
      "⏳ Sending your personalized learning reminder..."
    );

    try {
      const nextLesson = getNextLesson(chatId);

      let smsMessage;

      if (nextLesson) {
        smsMessage =
          "📚 Learning reminder\n\n" +
          "Your next lesson is: " + nextLesson.title + "\n\n" +
          "Ask me in Telegram about: " + nextLesson.title + "\n\n" +
          "You can also take a quiz with /quiz.";
      } else {
        smsMessage =
          "🎉 Great job! You have completed all available lessons.\n\n" +
          "Keep practicing with /quiz in Telegram.";
      }

      await sendSms(phone, smsMessage);

      stats.smsNotifications += 1;

      let confirmationMessage =
        "✅ SMS reminder sent successfully!\n\n" +
        "Please check your phone.";

      if (nextLesson) {
        confirmationMessage +=
          "\n\n📚 Next lesson sent: " + nextLesson.title;
      } else {
        confirmationMessage +=
          "\n\n🎉 You have completed all available lessons.";
      }

      bot.sendMessage(chatId, confirmationMessage);

    } catch (error) {
      console.error("SMS notification error:", error.message);

      bot.sendMessage(
        chatId,
        "❌ Sorry, I could not send the SMS reminder right now.\n\n" +
        "Please try again later."
      );
    }

    return;
  }

  // ---------- START ----------

  if (normalText === "/start") {
    sendStartMenu(chatId, message);

    return;
  }

  // ---------- TRACK 3 ----------

  if (normalText === "/track3") {
    bot.sendMessage(
      chatId,
      "🎯 Track 3: Accessible Learning and Employment Support\n\n" +
      "Choose what you need:",

      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "📚 Ask a Course Question",
                callback_data: "track3_course_question"
              }
            ],
            [
              {
                text: "🙋 Need a Person / Help",
                callback_data: "track3_need_person"
              }
            ],
            [
              {
                text: "🖥️ Share My Screen",
                callback_data: "track3_share_screen"
              }
            ],
            [
              {
                text: "💼 Job Alerts",
                callback_data: "track3_jobs"
              }
            ],
            [
              {
                text: "📋 Interview Support",
                callback_data: "track3_interview_support"
              }
            ]
          ]
        }
      }
    );

    return;
  }

  // ---------- ADMIN ----------

  if (normalText === "/admin") {
    if (!isAdmin(chatId)) {
      bot.sendMessage(
        chatId,
        "❌ Only teachers and admins can open the admin panel."
      );

      return;
    }

    bot.sendMessage(
      chatId,
      "👩‍🏫 Teacher Admin Panel\n\n" +
      "Choose an action:",

      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "👥 View Students",
                callback_data: "view_students"
              }
            ],
            [
              {
                text: "📢 Send Telegram Announcement",
                callback_data: "start_telegram_announcement"
              }
            ],
            [
              {
                text: "📩 Send SMS Announcement",
                callback_data: "start_sms_announcement"
              }
            ],
            [
              {
                text: "📊 View Teacher Analytics",
                callback_data: "view_teacher_analytics"
              }
            ]
          ]
        }
      }
    );

    return;
  }

  if (normalText === "/students") {
    if (!isAdmin(chatId)) {
      bot.sendMessage(
        chatId,
        "❌ Only teachers and admins can view students."
      );

      return;
    }

    sendStudentList(chatId);

    return;
  }

  if (normalText === "/announce") {
    if (!isAdmin(chatId)) {
      bot.sendMessage(
        chatId,
        "❌ Only teachers and admins can send announcements."
      );

      return;
    }

    userState.set(chatId, "waiting_announcement");

    bot.sendMessage(
      chatId,
      "📢 Please write the Telegram announcement for all students.\n\n" +
      "Send /cancel to stop."
    );

    return;
  }

  if (normalText === "/announce-sms") {
    if (!isAdmin(chatId)) {
      bot.sendMessage(
        chatId,
        "❌ Only teachers and admins can send SMS announcements."
      );

      return;
    }

    userState.set(chatId, "waiting_sms_announcement");

    bot.sendMessage(
      chatId,
      "📩 Please write the SMS announcement for all saved phone numbers.\n\n" +
      "Send /cancel to stop."
    );

    return;
  }

  if (normalText === "/cancel") {
    userState.delete(chatId);
    smsWaiting.delete(chatId);

    bot.sendMessage(
      chatId,
      "✅ Cancelled. You can use the bot normally now."
    );

    return;
  }

  // ---------- NORMAL COMMANDS ----------

  if (normalText === "/ping") {
    bot.sendMessage(chatId, "PONG v20");
    return;
  }

  if (normalText === "/myid") {
    bot.sendMessage(
      chatId,
      "🆔 Your Telegram Chat ID is:\n\n" +
      "`" + chatId + "`\n\n" +
      "Copy this number and add it in Railway as:\n\n" +
      "`ADMIN_CHAT_ID`",
      {
        parse_mode: "Markdown"
      }
    );

    return;
  }

  if (normalText === "/help") {
    userState.set(chatId, "waiting_help_question");

    bot.sendMessage(
      chatId,
      "🙋 Please write the question or problem you need help with.\n\n" +
      "A teacher or support person will receive your request."
    );

    return;
  }

  if (normalText === "/progress") {
    const completed = userProgress.get(chatId) || [];

    if (completed.length === 0) {
      bot.sendMessage(
        chatId,
        "📚 You have not completed any lessons yet.\n\n" +
        "Ask a course question, then tap:\n" +
        "✅ Show Full Explanation"
      );

      return;
    }

    const total = COURSE_DATA.lessons.length;

    bot.sendMessage(
      chatId,
      "📚 Your progress\n\n" +
      completed.map(title => "✅ " + title).join("\n") +
      "\n\nCompleted: " + completed.length + " of " + total + " lessons"
    );

    return;
  }

  if (normalText.startsWith("/quiz")) {
    const parts = text.split(" ");
    const quizName = parts[1];

    if (!quizName || !quizzes[quizName]) {
      sendQuizMenu(chatId);
      return;
    }

    userQuiz.set(chatId, {
      name: quizName,
      questionIndex: 0,
      score: 0
    });

    sendQuizQuestion(chatId, quizName, 0);

    return;
  }

  if (normalText === "/jobs") {
    sendJobAlerts(chatId);

    return;
  }

  if (normalText === "/lessons") {
    sendLessonMenu(chatId);

    return;
  }

  if (normalText === "/accommodation") {
    sendAccommodationMenu(chatId);

    return;
  }

  if (normalText === "/simple") {
    const current = simpleMode.get(chatId) || false;
    const next = !current;

    simpleMode.set(chatId, next);

    bot.sendMessage(
      chatId,
      next
        ? "🟢 Simple Mode is ON.\n\nI will give short and easy answers."
        : "🔵 Simple Mode is OFF.\n\nI will give normal answers."
    );

    return;
  }

  if (normalText === "/teacher" || normalText === "/teacher-stats") {
    if (!isAdmin(chatId)) {
      bot.sendMessage(
        chatId,
        "❌ Only teachers and admins can view teacher analytics."
      );

      return;
    }

    sendTeacherAnalytics(chatId);

    return;
  }

  const currentState = userState.get(chatId);

  // ---------- INDIVIDUAL TEACHER MESSAGE ----------

  if (
    currentState &&
    currentState.startsWith("waiting_individual_telegram_")
  ) {
    userState.delete(chatId);

    const studentChatId = currentState.replace(
      "waiting_individual_telegram_",
      ""
    );

    try {
      await bot.sendMessage(
        studentChatId,
        "📩 Message from your teacher:\n\n" + text
      );

      stats.individualTelegramMessages += 1;

      bot.sendMessage(
        chatId,
        "✅ Telegram message sent to student."
      );
    } catch (error) {
      console.error(
        "Individual Telegram message failed:",
        error.message
      );

      bot.sendMessage(
        chatId,
        "❌ Could not send the Telegram message.\n\n" +
        "The student may need to open the bot and press Start first."
      );
    }

    return;
  }

  if (
    currentState &&
    currentState.startsWith("waiting_individual_sms_")
  ) {
    userState.delete(chatId);

    const studentChatId = currentState.replace(
      "waiting_individual_sms_",
      ""
    );

    const phone = userPhones.get(Number(studentChatId));

    if (!phone) {
      bot.sendMessage(
        chatId,
        "❌ This student has not saved a phone number."
      );

      return;
    }

    try {
      await sendSms(
        phone,
        "📩 Message from your teacher:\n\n" + text
      );

      stats.individualSmsMessages += 1;
      stats.smsNotifications += 1;

      bot.sendMessage(
        chatId,
        "✅ SMS message sent to " + phone + "."
      );
    } catch (error) {
      console.error(
        "Individual SMS message failed:",
        error.message
      );

      bot.sendMessage(
        chatId,
        "❌ Could not send the SMS message."
      );
    }

    return;
  }

  // ---------- GROUP ANNOUNCEMENTS ----------

  if (currentState === "waiting_announcement") {
    userState.delete(chatId);

    const announcement = text.trim();

    let sent = 0;
    let failed = 0;

    for (const [userChatId, user] of botUsers) {
      if (user.role === "teacher") {
        continue;
      }

      try {
        await bot.sendMessage(
          userChatId,
          "📢 Teacher Announcement\n\n" + announcement
        );

        sent += 1;
      } catch (error) {
        console.error(
          "Telegram announcement failed for:",
          userChatId,
          error.message
        );

        failed += 1;
      }
    }

    stats.telegramAnnouncements += 1;

    bot.sendMessage(
      chatId,
      "✅ Telegram announcement sent to students.\n\n" +
      "Delivered: " + sent + "\n" +
      "Failed: " + failed
    );

    return;
  }

  if (currentState === "waiting_sms_announcement") {
    userState.delete(chatId);

    const announcement = text.trim();

    let sent = 0;
    let failed = 0;

    for (const [userChatId, phone] of userPhones) {
      try {
        await sendSms(
          phone,
          "📢 Teacher announcement:\n\n" + announcement
        );

        sent += 1;
      } catch (error) {
        console.error(
          "SMS announcement failed for:",
          phone,
          error.message
        );

        failed += 1;
      }
    }

    stats.smsAnnouncements += 1;

    bot.sendMessage(
      chatId,
      "✅ SMS announcement process finished.\n\n" +
      "SMS attempted: " + sent + "\n" +
      "Failed: " + failed
    );

    return;
  }

  // ---------- SUPPORT REQUESTS ----------

  if (currentState === "waiting_screen_link") {
    userState.delete(chatId);

    const meetingLink = text.trim();

    if (!meetingLink.startsWith("http")) {
      bot.sendMessage(
        chatId,
        "❌ Please send a valid meeting link.\n\n" +
        "Example:\n`https://meet.google.com/your-meeting-link`"
      );

      return;
    }

    stats.screenShareRequests += 1;

    sendScreenShareRequestToAdmin(chatId, meetingLink);

    bot.sendMessage(
      chatId,
      "✅ Your screen-sharing request has been sent.\n\n" +
      "A teacher or support person will use your link if they need to help you."
    );

    return;
  }

  if (currentState === "waiting_help_question") {
    userState.delete(chatId);

    stats.helpRequests += 1;

    sendHelpRequestToAdmin(chatId, text);

    bot.sendMessage(
      chatId,
      "✅ Your help request has been sent.\n\n" +
      "A teacher or support person will contact you soon."
    );

    return;
  }

  if (currentState === "waiting_accommodation") {
    const accommodationOptions = [
      "Extra time",
      "Screen reader support",
      "Sign language interpreter",
      "Quiet interview space",
      "Written questions",
      "Other"
    ];

    const choice = Number(text.trim());
    const accommodation = accommodationOptions[choice - 1];

    if (!accommodation) {
      bot.sendMessage(
        chatId,
        "Please reply with a number from 1 to 6."
      );

      return;
    }

    userState.delete(chatId);

    stats.accommodationRequests += 1;

    sendAccommodationRequestToAdmin(chatId, accommodation);

    bot.sendMessage(
      chatId,
      "✅ Your accommodation request has been sent.\n\n" +
      "Need: " + accommodation
    );

    return;
  }

  // ---------- JOB QUESTIONS ----------

  const jobAnswer = findJobAnswer(text);

  if (jobAnswer) {
    let reply;

    if (language === "amharic") {
      reply =
        jobAnswer.am +
        "\n\n🇬🇧 English:\n" +
        jobAnswer.en;
    } else {
      reply =
        jobAnswer.en +
        "\n\n🇪🇹 አማርኛ:\n" +
        jobAnswer.am;
    }

    bot.sendMessage(
      chatId,
      reply +
      "\n\n💼 You can also see job alerts with /jobs."
    );

    return;
  }

  // ---------- COURSE ANSWERS ----------

  const lesson = findCourseAnswer(text);

  if (lesson) {
    stats.courseQuestions += 1;

    const topic = lesson.title || "Unknown";

    if (!stats.topicCounts[topic]) {
      stats.topicCounts[topic] = 0;
    }

    stats.topicCounts[topic] += 1;

    userLessons.set(chatId, lesson);

    const simple = lesson.simple || {};
    const answer = lesson.answer || {};

    const englishSimple = simple.en || "";
    const amharicSimple = simple.am || "";
    const englishFull = answer.en || "";
    const amharicFull = answer.am || "";

    const useSimpleMode = simpleMode.get(chatId) || false;

    let replyText;

    if (language === "amharic") {
      replyText = useSimpleMode
        ? amharicSimple
        : amharicFull || amharicSimple;

      if (englishSimple || englishFull) {
        replyText +=
          "\n\n🇬🇧 English:\n" +
          (useSimpleMode ? englishSimple : englishFull || englishSimple);
      }
    } else {
      replyText = useSimpleMode
        ? englishSimple
        : englishFull || englishSimple;

      if (amharicSimple || amharicFull) {
        replyText +=
          "\n\n🇪🇹 አማርኛ:\n" +
          (useSimpleMode ? amharicSimple : amharicFull || amharicSimple);
      }
    }

    const source = getSource(lesson);

    bot.sendMessage(
      chatId,
      replyText +
      "\n\n" +
      source +
      "\n\nWould you like the full explanation?",

      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✅ Show Full Explanation",
                callback_data: "full_answer"
              }
            ]
          ]
        }
      }
    );

    return;
  }

  // ---------- AI ANSWER ----------

  stats.aiQuestions += 1;

  bot.sendMessage(chatId, "🔎 Thinking...");

  try {
    const groqAnswer = await askGroq(text, language);

    if (groqAnswer) {
      bot.sendMessage(
        chatId,
        groqAnswer +
        "\n\n🤖 Answer generated by Groq."
      );

      return;
    }

    bot.sendMessage(
      chatId,
      "I can help with questions from the Internet Basics course.\n\n" +
      "Try asking:\n" +
      "• What is downloading?\n" +
      "• ማውረድ ምን ማለት ነው?\n" +
      "• What is the internet?\n" +
      "• What is a hyperlink?\n" +
      "• How can I stay safe online?"
    );
  } catch (error) {
    console.error(
      "Groq answer failed:",
      error.message || error
    );

    bot.sendMessage(
      chatId,
      "Sorry, I could not answer that question right now. Please try again."
    );
  }
});

function sendStartMenu(chatId, message) {
  const role = isAdmin(chatId) ? "Teacher / Admin" : "Student";

  const studentWelcome =
    "🇪🇹 እንኳን ደህና መጡ!\n\n" +
    "ይህ ቦት ለትምህርት፣ ለሥራ እና ለድጋፍ ይረዳዎታል።\n\n" +
    "በአማርኛ ወይም በእንግሊዝኛ መጠየቅ ይችላሉ።\n\n" +
    "ለምሳሌ ይጻፉ፦\n" +
    "• ማውረድ ምን ማለት ነው?\n" +
    "• ሥራ ለመመልከት እንዴት እችላለሁ?\n" +
    "• ኢንተርኔት ምን ማለት ነው?\n\n" +
    "🇬🇧 Welcome!\n\n" +
    "This bot helps you learn, find jobs, and get support.\n\n" +
    "You can ask in Amharic or English.\n\n" +
    "Examples:\n" +
    "• What is downloading?\n" +
    "• How do I apply for a job?\n" +
    "• What is the internet?\n\n" +
    "Your role: " + role;

  const teacherWelcome =
    "🇪🇹 እንኳን ደህና መጡ መምህር!\n\n" +
    "ተማሪዎችን ማየት፣ መልእክት መላክ፣ ማስታወቂያ መላክ እና የትምህርት መረጃ ማየት ይችላሉ።\n\n" +
    "🇬🇧 Welcome, Teacher!\n\n" +
    "You can view students, send individual messages, send announcements, and view learning analytics.\n\n" +
    "Your role: " + role;

  const welcomeText = isAdmin(chatId) ? teacherWelcome : studentWelcome;

  const studentButtons = [
    [
      {
        text: "📚 ትምህርት ጀምር / Start Learning",
        callback_data: "student_learning"
      }
    ],
    [
      {
        text: "🎯 የTrack 3 ድጋፍ / Track 3 Support",
        callback_data: "track3_menu"
      }
    ],
    [
      {
        text: "💼 የሥራ ማስታወቂያ / Job Alerts",
        callback_data: "track3_jobs"
      }
    ],
    [
      {
        text: "📋 የቃለ መጠይቅ ድጋፍ / Interview Support",
        callback_data: "track3_interview_support"
      }
    ],
    [
      {
        text: "🟢 ቀላል መልስ / Simple Mode",
        callback_data: "toggle_simple_mode"
      }
    ],
    [
      {
        text: "📩 የSMS አስታዋሽ / SMS Reminder",
        callback_data: "sms_notification"
      }
    ],
    [
      {
        text: "🙋 እርዳታ አስፈልገኛል / I Need Help",
        callback_data: "track3_need_person"
      }
    ]
  ];

  const teacherButtons = [
    [
      {
        text: "🧑‍🏫 የመምህር ፓነል / Teacher Panel",
        callback_data: "teacher_panel"
      }
    ],
    [
      {
        text: "👥 ተማሪዎች / Students",
        callback_data: "view_students"
      }
    ],
    [
      {
        text: "📢 ለሁሉም ተማሪ መልእክት / Announce",
        callback_data: "start_telegram_announcement"
      }
    ],
    [
      {
        text: "📩 ለሁሉም ተማሪ SMS / SMS Announcement",
        callback_data: "start_sms_announcement"
      }
    ],
    [
      {
        text: "📊 የትምህርት መረጃ / Analytics",
        callback_data: "view_teacher_analytics"
      }
    ],
    [
      {
        text: "🎯 የTrack 3 ድጋፍ / Track 3 Support",
        callback_data: "track3_menu"
      }
    ]
  ];

  const buttons = isAdmin(chatId) ? teacherButtons : studentButtons;

  bot.sendMessage(
    chatId,
    welcomeText,

    {
      reply_markup: {
        inline_keyboard: buttons
      }
    }
  );
}

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("SMS webhook is running on port " + PORT);
});

console.log("Telegram bot is running.");