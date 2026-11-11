const { Telegraf } = require('telegraf');
const Groq = require('groq-sdk');

const bot = new Telegraf(process.env.TELEGRAM_TOKEN || '9281732550:AAHuH2XS3Aw0Ok0w703aaKbbGgx-_MLTFyw');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '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' });

const WEBSITE_LINK = 'https://your-netlify-link.netlify.app'; // ← Change this

bot.start((ctx) => {
  ctx.reply(
    'Hello! / ሰላም!\n\n' +
    'I am the Multilingual Learning Assistant.\n' +
    'Ask me anything. I reply in both languages when possible.\n\n' +
    'Website: ' + WEBSITE_LINK + '\n\n' +
    'Commands:\n/help - Request human help'
  );
});

bot.command('help', (ctx) => {
  ctx.reply('For human help, use the Request Human Help button on the website or contact a facilitator.');
});

bot.on('text', async (ctx) => {
  const text = ctx.message.text || '';
  if (text.startsWith('/')) return;

  const lower = text.toLowerCase();

  // Give website link
  if (lower.includes('website') || lower.includes('link') || text.includes('ድረ ገጽ') || text.includes('ድህረገጽ')) {
    return ctx.reply('Here is the website:\n' + WEBSITE_LINK + '\n\nClick the link to open it.');
  }

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

const systemPrompt = `You are a helpful learning assistant for people with disabilities in Ethiopia. 
Reply in the same language as the user (Amharic or English). 
Be clear, respectful, and simple. 
Focus on learning, accessibility, visual support, hearing, mobility, and jobs. 
Keep answers useful but not too long.`;

bot.launch();
console.log('Bot started');