import { GoogleGenerativeAI } from '@google/generative-ai';
import TelegramBot from 'node-telegram-bot-api';

export default async ({ req, res, log, error }) => {
  // فقط به درخواست‌های تلگرام جواب میدیم
  if (req.method !== 'POST') {
    return res.json({ success: false });
  }

  try {
    // دریافت اطلاعات کلیدی از تنظیمات
    const token = process.env.TELEGRAM_TOKEN;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!token || !geminiKey) {
      throw new Error('تنظیمات توکن یا جمینای وارد نشده است');
    }

    // راه‌اندازی ربات و هوش مصنوعی
    const bot = new TelegramBot(token);
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    // تحلیل پیام دریافتی
    const body = JSON.parse(req.body);
    let chatId, text, callbackData, firstName, messageId;

    if (body.callback_query) {
      chatId = body.callback_query.message.chat.id;
      callbackData = body.callback_query.data;
      firstName = body.callback_query.from.first_name;
      messageId = body.callback_query.message.message_id;
      // حذف حالت لودینگ دکمه
      await bot.answerCallbackQuery(body.callback_query.id);
    } else if (body.message) {
      chatId = body.message.chat.id;
      text = body.message.text;
      firstName = body.message.from.first_name;
    } else {
      return res.json({ status: 'ok' });
    }

    // منطق ربات
    let prompt = '';
    let replyMarkup = null;

    // 1. نمایش منوی اصلی
    if (text === '/start' || callbackData === 'menu') {
      const menuText = `سلام ${firstName} عزیز! 👋\nمن کوچ هوشمند توسعه فردی تو هستم.\n\nچطور می‌تونم کمکت کنم؟`;
      const options = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📅 چالش روزانه', callback_data: 'challenge' }],
            [{ text: '📚 خلاصه کتاب', callback_data: 'book' }, { text: '⚡ انگیزه', callback_data: 'motivation' }],
            [{ text: '🎯 هدف‌گذاری', callback_data: 'goal' }, { text: '💪 عادت‌سازی', callback_data: 'habit' }],
            [{ text: '💬 چت با منتور', callback_data: 'mentor' }]
          ]
        }
      };
      
      await bot.sendMessage(chatId, menuText, options);
      return res.json({ success: true });
    }

    // 2. انتخاب پرامپت بر اساس دکمه
    if (callbackData) {
      // نمایش تایپینگ
      await bot.sendChatAction(chatId, 'typing');

      switch (callbackData) {
        case 'challenge':
          prompt = "یک چالش توسعه فردی کوچک و عملی (زیر 15 دقیقه) برای امروز پیشنهاد بده. شامل عنوان، زمان و چک‌لیست باشد.";
          break;
        case 'book':
          prompt = "یک کتاب شاهکار روانشناسی یا موفقیت معرفی کن. نام، نویسنده، ۳ نکته طلایی و یک تمرین عملی.";
          break;
        case 'motivation':
          prompt = "یک جمله انگیزشی عمیق بگو و تحلیل کن چرا مهمه و چطور امروز اجراش کنیم.";
          break;
        case 'goal':
          prompt = "تکنیک هدف‌گذاری SMART را توضیح بده و یک مثال واقعی بزن. سپس از کاربر بخواه هدفش را بگوید.";
          break;
        case 'habit':
          prompt = "یک سیستم ساده برای ساخت عادت جدید طراحی کن (قانون 2 دقیقه، پیوند عادت).";
          break;
        case 'mentor':
          prompt = "به کاربر خوش‌آمد بگو و بگو: 'من سراپا گوشم. هر سوالی داری یا مشورتی می‌خوای بپرس.'";
          break;
      }
    } 
    // 3. چت آزاد
    else if (text) {
      await bot.sendChatAction(chatId, 'typing');
      prompt = `تو یک منتور دانا هستی. کاربر می‌گوید: "${text}". پاسخ همدلانه و کاربردی بده.`;
    }

    // 4. ارسال به هوش مصنوعی و دریافت پاسخ
    if (prompt) {
      const result = await model.generateContent(prompt);
      const response = result.response;
      const aiText = response.text();

      // ارسال جواب به تلگرام
      await bot.sendMessage(chatId, aiText, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '🏠 منوی اصلی', callback_data: 'menu' }]]
        }
      });
    }

    return res.json({ success: true });

  } catch (err) {
    error(err.message);
    return res.json({ success: false, error: err.message });
  }
};
