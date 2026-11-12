const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

console.log("BOT VERSION: v6 commands fixed");

const TOKEN = process.env.BOT_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

if (!TOKEN) {
  console.error("BOT_TOKEN is missing. Add it in Railway Variables.");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, {
  polling: true
});

let COURSE_DATA = {
  lessons: []
};

try {
  COURSE_DATA = JSON.parse(
    fs.readFileSync("course-data.json", "utf8")
  );

  console.log("Course lessons loaded:", COURSE_DATA.lessons.length);
} catch (error) {
  console.error("Could not load course-data.json:", error);
}

const userLessons = new Map();
const userProgress = new Map();
const userQuiz = new Map();
const userState = new Map();


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
  ]
};


const jobs = [
  {
    title: "Data Entry Assistant",
    organization: "Local Organization",
    location: "Addis Ababa",
    deadline: "2026-11-30",
    link: "https://example.com/apply"
  },
  {
    title: "Online English Tutor",
    organization: "Learning Center",
    location: "Remote",
    deadline: "2026-12-05",
    link: "https://example.com/apply"
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


bot.on("message", async message => {
  const chatId = message.chat.id;
  const text = message.text;

  if (!text) {
    return;
  }

  const normalText = text.toLowerCase().trim();

  console.log("BOT VERSION: v6 commands fixed");
  console.log("Received message:", text);

  if (normalText === "/start") {
    console.log("START COMMAND RECEIVED");

    bot.sendMessage(
      chatId,
      "Hello! I am your Learning Assistant.\n\n" +
      "You can ask course questions or general questions.\n\n" +
      "Commands:\n" +
      "• /help — request human help\n" +
      "• /progress — see your progress\n" +
      "• /quiz downloading — take a quiz\n" +
      "• /jobs — see job alerts\n" +
      "• /accommodation — request interview support\n\n" +
      "Examples:\n" +
      "• What is downloading?\n" +
      "• What is the internet?\n" +
      "• What is photosynthesis?\n" +
      "• What is the capital of Kenya?"
    );

    return;
  }

    if (normalText === "/ping") {
    bot.sendMessage(chatId, "PONG v6");
    return;
  }

  if (normalText === "/help") {
    console.log("HELP COMMAND RECEIVED");

    userState.set(chatId, "waiting_help_question");

    bot.sendMessage(
      chatId,
      "Please write the question or problem you need help with.\n\n" +
      "A teacher or support person will receive your request."
    );

    return;
  }

  if (normalText === "/progress") {
    console.log("PROGRESS COMMAND RECEIVED");

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
    console.log("QUIZ COMMAND RECEIVED");

    const parts = text.split(" ");
    const quizName = parts[1];

    if (!quizName || !quizzes[quizName]) {
      bot.sendMessage(
        chatId,
        "Please choose a quiz:\n\n" +
        "• /quiz downloading"
      );

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
    console.log("JOBS COMMAND RECEIVED");

    let jobText = "💼 Job Alerts\n\n";

    jobs.forEach((job, index) => {
      jobText +=
        (index + 1) + ". " + job.title + "\n" +
        "Organization: " + job.organization + "\n" +
        "Location: " + job.location + "\n" +
        "Deadline: " + job.deadline + "\n" +
        "Apply: " + job.link + "\n\n";
    });

    bot.sendMessage(chatId, jobText);

    return;
  }

  if (normalText === "/accommodation") {
    console.log("ACCOMMODATION COMMAND RECEIVED");

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

  const currentState = userState.get(chatId);

  if (currentState === "waiting_help_question") {
    userState.delete(chatId);

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

      bot.sendMessage(
        chatId,
        "🎉 Quiz finished!\n\n" +
        "Your score: " + userQuizData.score + " out of " + quiz.length + "\n\n" +
        "Try another quiz:\n" +
        "• /quiz downloading"
      );
    }
  }
});


console.log("Telegram bot is running.");