const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const africastalking = require('africastalking');

// ==============================
// BOT VERSION
// ==============================
console.log('BOT VERSION: v9 SMS support');

// ==============================
// ENVIRONMENT CHECK
// ==============================
const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const atUsername = process.env.AT_USERNAME;
const atApiKey = process.env.AT_API_KEY;
const atSenderId = process.env.AT_SENDER_ID;

if (!telegramToken) {
  console.error('TELEGRAM_BOT_TOKEN is missing.');
  process.exit(1);
}

if (!atUsername || !atApiKey) {
  console.error("Africa's Talking username or API key is missing.");
  process.exit(1);
}

console.log("Africa's Talking username loaded:", atUsername);
console.log("Africa's Talking API key loaded:", atApiKey ? 'Yes' : 'No');
console.log("Africa's Talking sender ID loaded:", atSenderId || 'Not set');

// ==============================
// TELEGRAM BOT
// ==============================
const bot = new TelegramBot(telegramToken, { polling: true });

console.log('Telegram bot is running.');

// ==============================
// COURSE LESSONS
// ==============================
const lessons = {
  'what is downloading?': 'Downloading means saving a file from the internet to your device.',
  'what is uploading?': 'Uploading means sending a file from your device to the internet.',
  'what is the internet?': 'The internet is a global network that connects computers and phones so people can share information.',
  'what is a website?': 'A website is a place on the internet where you can read information, watch videos, or use services.',
  'what is a browser?': 'A browser is an app used to open websites. Examples are Chrome, Safari, and Firefox.',
  'what is email?': 'Email is a way to send messages and files to people using the internet.',
  'what is a password?': 'A password is a secret word or phrase used to protect your account.',
  'what is wifi?': 'Wi-Fi is a wireless internet connection. It lets your phone or computer connect to the internet without cables.',
  'what is a link?': 'A link is text or an image you can click to open another page or website.',
  'what is a search engine?': 'A search engine helps you find information on the internet. Examples are Google and Bing.',
  'what is an app?': 'An app is a program installed on a phone or computer. Examples are WhatsApp, Telegram, and Chrome.',
  'what is a file?': 'A file is a document, photo, video, or other item saved on a device.',
  'what is a download folder?': 'The download folder is where files saved from the internet are usually stored.',
  'what is online safety?': 'Online safety means protecting your personal information, using strong passwords, and avoiding suspicious links.'
};

const courseIntro =
  'Welcome to Internet Basics!\n\n' +
  'Ask me a question such as:\n' +
  '• What is downloading?\n' +
  '• What is the internet?\n' +
  '• What is a browser?\n' +
  '• What is a password?\n\n' +
  'Type /lessons to see available topics.';

// ==============================
// TELEGRAM COMMANDS
// ==============================
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, courseIntro);
});

bot.onText(/\/lessons/, (msg) => {
  const lessonList = Object.keys(lessons)
    .map((question) => `• ${question.replace(/\?$/, '')}`)
    .join('\n');

  bot.sendMessage(
    msg.chat.id,
    'Available Internet Basics lessons:\n\n' + lessonList
  );
});

bot.onText(/\/teacher/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    'Teacher mode is active.\n\nAsk me any Internet Basics question.'
  );
});

bot.onText(/\/stop/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    'Teacher mode stopped. Send /start to begin again.'
  );
});

// ==============================
// TELEGRAM QUESTIONS
// ==============================
bot.on('message', (msg) => {
  const text = msg.text;

  if (!text || text.startsWith('/')) {
    return;
  }

  const question = text.toLowerCase().trim();

  if (lessons[question]) {
    bot.sendMessage(msg.chat.id, lessons[question]);
    return;
  }

  const matchedKey = Object.keys(lessons).find((key) => {
    return question.includes(key.replace('?', '').trim());
  });

  if (matchedKey) {
    bot.sendMessage(msg.chat.id, lessons[matchedKey]);
    return;
  }

  bot.sendMessage(
    msg.chat.id,
    'Sorry, I can answer Internet Basics questions. Try asking:\n\nWhat is downloading?'
  );
});

// ==============================
// AFRICA'S TALKING SMS
// ==============================
const at = africastalking({
  apiKey: atApiKey,
  username: atUsername
});

const sms = at.SMS;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send('Learning Assistant SMS bot is running.');
});

app.post('/sms', async (req, res) => {
  try {
    const incomingMessage = req.body;

    const fromNumber = incomingMessage.from;
    const messageText = incomingMessage.text;

    console.log('SMS received:', messageText);

    if (!messageText || !fromNumber) {
      return res.status(200).send('OK');
    }

    const question = messageText.toLowerCase().trim();

    let reply =
      'Sorry, I can answer Internet Basics questions by SMS. Try asking: What is downloading?';

    if (lessons[question]) {
      reply = lessons[question];
    } else {
      const matchedKey = Object.keys(lessons).find((key) => {
        return question.includes(key.replace('?', '').trim());
      });

      if (matchedKey) {
        reply = lessons[matchedKey];
      }
    }

    console.log('SMS reply:', reply);

    let recipient = fromNumber.toString().trim();

    if (!recipient.startsWith('+')) {
      recipient = '+' + recipient;
    }

    const smsOptions = {
      to: [recipient],
      message: reply
    };

    if (atSenderId) {
      smsOptions.from = atSenderId;
    }

    try {
      const response = await sms.send(smsOptions);

      console.log("Africa's Talking response:", JSON.stringify(response));
    } catch (smsError) {
      console.error('SMS send error:', smsError.message);

      if (smsError.response && smsError.response.data) {
        console.error(
          'SMS send error details:',
          JSON.stringify(smsError.response.data)
        );
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('SMS webhook error:', error.message);
    res.status(200).send('OK');
  }
});

// ==============================
// START SERVER
// ==============================
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`SMS webhook is running on port ${PORT}`);
});