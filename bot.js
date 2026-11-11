const { Telegraf } = require('telegraf');
const Groq = require('groq-sdk');

const bot = new Telegraf('9281732550:AAHuH2XS3Aw0Ok0w703aaKbbGgx-_MLTFyw');
const groq = new Groq({ apiKey: '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' });

function isAmharic(text) {
  return /[\u1200-\u137F]/.test(text);
}

bot.start((ctx) => {
  ctx.reply(
    'Hello! / ሰላም!\n\n' +
    'I am the Multilingual Learning Assistant.\n' +
    'Ask me anything. I reply in both languages when possible.\n\n' +
    'Commands:\n/help - Request human help'
  );
});

bot.command('help', (ctx) => {
  ctx.reply('For human help, use the Request Human Help button on the website or contact a facilitator.');
});

bot.on('text', async (ctx) => {
  const text = ctx.message.text || '';
  if (text.startsWith('/')) return;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are the Multilingual Learning Assistant created by Eba Mengistu (Software Engineer and Full Stack Developer) for the Accessibility Hackathon 2026 in Ethiopia.

Strict rules:
- If asked who you are, always say: "I am the Multilingual Learning Assistant."
- If asked who created you, always say: "I was created by Eba Mengistu."
- Never say you were created by OpenAI, ChatGPT, or any other company.
- If the user writes in English, answer in English first, then give the Amharic version.
- If the user writes in Amharic, answer in Amharic first, then give the English version.
- If they ask for a translation, provide it clearly.
- Be helpful, clear, and not too long.`
        },
        { role: 'user', content: text }
      ],
      model: 'openai/gpt-oss-20b',
      temperature: 0.4,
      max_tokens: 500
    });

    const answer = completion.choices[0]?.message?.content?.trim();
    ctx.reply(answer || 'Sorry, I could not generate an answer.');
  } catch (error) {
    console.error(error);
    ctx.reply('Sorry, something went wrong. Please try again.');
  }
});

bot.launch();
console.log('Bot started');