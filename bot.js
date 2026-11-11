const { Telegraf } = require('telegraf');
const Groq = require('groq-sdk');
const express = require('express');
const cors = require('cors');

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const app = express();
app.use(cors());
app.use(express.json());

const WEBSITE_LINK = 'https://m-at.netlify.app/';

// Telegram Bot
bot.start((ctx) => {
  ctx.reply(
    'Hello! / ሰላም!\n\n' +
    'I am the Multilingual Learning Assistant.\n' +
    'Website: ' + WEBSITE_LINK + '\n\n' +
    'Commands:\n/help - Request human help'
  );
});

bot.command('help', (ctx) => {
  ctx.reply('For human help, use the Request Human Help button on the website.');
});

bot.on('text', async (ctx) => {
  const text = ctx.message.text || '';
  if (text.startsWith('/')) return;

  const lower = text.toLowerCase();
  if (lower.includes('website') || lower.includes('link') || text.includes('ድረ ገጽ')) {
    return ctx.reply('Here is the website:\n' + WEBSITE_LINK);
  }

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are the Multilingual Learning Assistant created by Eba Mengistu.
If asked who you are, say you are the Multilingual Learning Assistant.
If asked who created you, say Eba Mengistu.
Answer in the same language the user uses.
Be helpful and clear.`
        },
        { role: 'user', content: text }
      ],
      model: 'openai/gpt-oss-20b',
      max_tokens: 400
    });

    const answer = completion.choices[0]?.message?.content?.trim() || 'Sorry, no answer.';
    ctx.reply(answer);
  } catch (err) {
    console.error(err);
    ctx.reply('Sorry, try again.');
  }
});

// API for Website
app.post('/ask', async (req, res) => {
  const question = req.body.question || '';
  if (!question) return res.json({ answer: 'Please ask a question.' });

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are the Multilingual Learning Assistant created by Eba Mengistu. Answer clearly and helpfully in the same language the user uses.'
        },
        { role: 'user', content: question }
      ],
      model: 'openai/gpt-oss-20b',
      max_tokens: 400
    });

    const answer = completion.choices[0]?.message?.content || 'Sorry, no answer.';
    res.json({ answer });
  } catch (err) {
    console.error(err);
    res.json({ answer: 'Sorry, try again.' });
  }
});

// Health check (useful for Railway)
app.get('/', (req, res) => {
  res.send('Learning Assistant API is running');
});

// Listen on the port Railway expects
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log('API running on port', PORT);
});

bot.launch();
console.log('Bot started');