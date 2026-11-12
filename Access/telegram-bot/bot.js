const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");
const express = require("express");

console.log("BOT VERSION: v9 SMS support");

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
  console.error("Could not load course-data.json:", error);
}

const userLessons = new Map();
const userProgress = new Map();
const userQuiz = new Map();
const userState = new Map();

const stats = {
  totalQuestions: 0,
  courseQuestions: 0,
  aiQuestions: 0,
  helpRequests: 0,
  accommodationRequests: 0,
  quizCompletions: 0,
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

function getSimpleAnswer(lesson) {
  const simple = lesson.simple || {};

  return simple.en || simple.am || "";
}

function getFullAnswer(lesson) {
  const answer = lesson.answer || {};

  return answer.en || answer.am || "";
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

function sendHelpRequestToAdmin(chatId, question) {
  if (!ADMIN_CHAT_ID) {
    return;
  }

  bot.sendMessage(
    ADMIN_CHAT_ID,
    "🔔 New help request\n\n" +
    "User ID: " + chatId + "\n" +
    "Question: " + question
  );
}

function sendAccommodationRequestToAdmin(chatId, accommodation) {
  if (!ADMIN_CHAT_ID) {
    return;
  }

  bot.sendMessage(
    ADMIN_CHAT_ID,
    "📋 Interview accommodation request\n\n" +
    "User ID: " + chatId + "\n" +
    "Need: " + accommodation
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
  const quizButtons = [
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
  ];

  bot.sendMessage(
    chatId,
    "Choose a quiz:",
    {
      reply_markup: {
        inline_keyboard: quizButtons
      }
    }
  );
}

async function askGroq(question) {
  if (!GROQ_API_KEY) {
    console.error("GROQ_API_KEY is missing in Railway Variables.");
    return null;
  }

  const cleanKey = GROQ_API_KEY.trim();

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
            content:
              "You are a simple learning assistant for beginners. " +
              "Answer clearly in simple English. " +
              "If the learner writes in Amharic, answer in Amharic. " +
              "Keep the answer short, helpful, and easy to understand. " +
              "Do not give medical, legal, or financial advice."
          },
          {
            role: "user",
            content: question
          }
        ],
        temperature: 0.3,
        max_tokens: 500
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

  console.log("Sending SMS using:");
  console.log("Username:", username);
  console.log("API key starts with:", apiKey.substring(0, 8));
  console.log("Sender ID:", senderId || "Not set");

  const body = new URLSearchParams();
  body.append("username", username);
  body.append("to", to);
  body.append("message", message);

  if (senderId) {
    body.append("from", senderId);
  }

  try {
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
      console.error("Africa's Talking rejected the request.");
    }
  } catch (error) {
    console.error("SMS send failed:", error.message);
  }
}

app.post("/sms", async (req, res) => {
  const incomingMessage = req.body.text || "";
  const sender = req.body.from || "";

  const lesson = findCourseAnswer(incomingMessage);

  let reply;

  if (lesson) {
    reply = getSimpleAnswer(lesson);
  } else {
    reply =
      "Sorry, I can answer Internet Basics questions by SMS. " +
      "For more help, use our Telegram bot.";
  }

  console.log("SMS received:", incomingMessage);
  console.log("SMS reply:", reply);

  if (sender && reply) {
    try {
      await sendSms(sender, reply);
    } catch (error) {
      console.error("SMS send failed:", error);
    }
  }

  res.status(200).send("OK");
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

  if (normalText === "/start") {
    bot.sendMessage(
      chatId,
      "Hello! I am your Learning Assistant.\n\n" +
      "You can ask course questions or general questions.\n\n" +
      "Commands:\n" +
      "• /help — request human help\n" +
      "• /progress — see your progress\n" +
      "• /quiz — choose a quiz\n" +
      "• /jobs — see job alerts\n" +
      "• /accommodation — request interview support\n" +
      "• /teacher — teacher analytics\n\n" +
      "You can also ask course questions by SMS.\n\n" +
      "Examples:\n" +
      "• What is downloading?\n" +
      "• What is the internet?\n" +
      "• What is photosynthesis?\n" +
      "• What is the capital of Kenya?"
    );

    return;
  }

  if (normalText === "/ping") {
    bot.sendMessage(chatId, "PONG v9");
    return;
  }

  if (normalText === "/help") {
    userState.set(chatId, "waiting_help_question");

    bot.sendMessage(
      chatId,
      "Please write the question or problem you need help with.\n\n" +
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
        "✅ Yes, show full answer"
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
    let jobText = "💼 Job Alerts\n\n";
    jobText += "Tap a job title to see details.\n\n";

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
      jobText,
      {
        reply_markup: {
          inline_keyboard: jobButtons
        }
      }
    );

    return;
  }

  if (normalText === "/accommodation") {
    userState.set(chatId, "waiting_accommodation");

    bot.sendMessage(
      chatId,
      "What accommodation do you need for an interview?\n\n" +
      "1. Extra time\n" +
      "2. Screen reader support\n" +
      "3. Sign language interpreter\n" +
      "4. Quiet interview space\n" +
      "5. Written questions\n" +
      "6. Other\n\n" +
      "Please reply with a number."
    );

    return;
  }

  if (normalText === "/teacher" || normalText === "/teacher-stats") {
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
      "Quiz completions: " + stats.quizCompletions + "\n\n" +
      "Most asked topics:\n" +
      topicText
    );

    return;
  }

  const currentState = userState.get(chatId);

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

  const lesson = findCourseAnswer(text);

  if (lesson) {
    stats.courseQuestions += 1;

    const topic = lesson.title || "Unknown";

    if (!stats.topicCounts[topic]) {
      stats.topicCounts[topic] = 0;
    }

    stats.topicCounts[topic] += 1;

    userLessons.set(chatId, lesson);

    const simpleAnswer = getSimpleAnswer(lesson);
    const source = getSource(lesson);

    bot.sendMessage(
      chatId,
      simpleAnswer +
      "\n\n" +
      source +
      "\n\nWould you like the full explanation?",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✅ Yes, show full answer",
                callback_data: "full_answer"
              }
            ]
          ]
        }
      }
    );

    return;
  }

  stats.aiQuestions += 1;

  bot.sendMessage(chatId, "🔎 Thinking...");

  try {
    const groqAnswer = await askGroq(text);

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

bot.on("callback_query", async callbackQuery => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

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
        "Please first ask a course question, such as: What is downloading?"
      );

      bot.answerCallbackQuery(callbackQuery.id);

      return;
    }

    saveUserProgress(chatId, lesson.title);

    const fullAnswer = getFullAnswer(lesson);
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

    const jobDetails =
      "💼 " + job.title + "\n\n" +
      "Organization: " + job.organization + "\n" +
      "Location: " + job.location + "\n" +
      "Type: " + job.type + "\n" +
      "Deadline: " + job.deadline + "\n\n" +
      "Apply here:\n" +
      job.link;

    bot.sendMessage(chatId, jobDetails);

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
        "Try another quiz:\n" +
        "• /quiz downloading\n" +
        "• /quiz internet\n" +
        "• /quiz safety\n" +
        "• /quiz email"
      );
    }
  }
});

const PORT = process.env.PORT || 8080;

// ---------- NEW: SMS NOTIFICATION BUTTON ----------

bot.onText(/\/sms/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    "📩 *SMS Notification*\n\n" +
    "Please send your phone number in this format:\n\n" +
    "`+251912345678`\n\n" +
    "I will send you a learning reminder by SMS.",
    {
      parse_mode: "Markdown",
      reply_markup: {
        force_reply: true
      }
    }
  );

  smsWaiting.set(chatId, true);
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;

  if (!smsWaiting.get(chatId)) return;

  const phone = msg.text?.trim();

  if (!phone) return;

  // Only accept Ethiopian-style phone numbers
  const phonePattern = /^\+2519\d{8}$/;

  if (!phonePattern.test(phone)) {
    bot.sendMessage(
      chatId,
      "❌ Please send a valid Ethiopian phone number.\n\nExample:\n`+251912345678`",
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

  bot.sendMessage(
    chatId,
    "⏳ Sending your SMS notification..."
  );

  try {
    await sendSms(
      phone,
      "Hello! This is a reminder from your Learning Assistant. " +
      "You can ask questions, take quizzes, and get learning support anytime."
    );

    bot.sendMessage(
      chatId,
      "✅ SMS notification sent successfully!\n\n" +
      "Please check your phone."
    );

  } catch (error) {
    console.error("SMS notification error:", error.message);

    bot.sendMessage(
      chatId,
      "❌ Sorry, I could not send the SMS notification right now.\n\nPlease try again later."
    );
  }
});

// Remember which user is waiting to send a phone number
const smsWaiting = new Map();

app.listen(PORT, () => {
  console.log("SMS webhook is running on port " + PORT);
});

console.log("Telegram bot is running.");