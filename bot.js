const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const TOKEN = process.env.BOT_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

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


function normalizeText(text) {
  return String(text)
    .toLowerCase()
    .replace(/[?؟!.።,،]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function findCourseAnswer(question) {
  const questionText = normalizeText(question);
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

      if (questionText.includes(keywordText)) {
        score += 2;
      }
    });

    const lessonTitle = normalizeText(lesson.title || "");

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


async function askGroq(question) {
  if (!GROQ_API_KEY) {
    console.error("GROQ_API_KEY is missing in Railway Variables.");
    return null;
  }

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + GROQ_API_KEY
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
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

  if (normalText === "/start") {
    bot.sendMessage(
      chatId,
      "Hello! Ask me a question from the Internet Basics course.\n\n" +
      "Examples:\n" +
      "• What is downloading?\n" +
      "• What is the internet?\n" +
      "• What is a hyperlink?\n" +
      "• How can I stay safe online?"
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

    const fullAnswer = getFullAnswer(lesson);
    const source = getSource(lesson);

    bot.sendMessage(
      chatId,
      fullAnswer + "\n\n" + source
    );

    bot.answerCallbackQuery(callbackQuery.id, {
      text: "Full answer sent"
    });
  }
});


console.log("Telegram bot is running.");