import { NextRequest, NextResponse } from 'next/server';
import * as nodemailer from 'nodemailer';
import { loadDb } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, message, reason } = body;
    
    console.log('📧 Заявка:', { name, email, phone, reason });
    
    // Загружаем настройки из БД
    const db = loadDb();
    const config = db.emailConfig;
    
    if (!config?.smtpUser || !config?.smtpPass) {
      console.error('🚨 Email config не найден в БД');
      return NextResponse.json({ error: 'Email не настроен' }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass
      }
    } as nodemailer.TransportOptions);

    await transporter.verify();
    console.log('✅ SMTP OK');

    await transporter.sendMail({
      from: `"${config.fromName}" <${config.smtpUser}>`,
      to: config.smtpUser,
      subject: `🐼 Заявка: ${name} (${reason})`,
      text: `Имя: ${name}\nТелефон: ${phone}\nEmail: ${email}\nЖелание: ${reason}\nСообщение: ${message}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #10b981;">🐼 Новая заявка!</h2>
          <div style="background: #d1fae5; padding: 20px; border-radius: 12px; border-left: 5px solid #10b981;">
            <p><strong>👤 Имя:</strong> ${name}</p>
            <p><strong>📱 Телефон:</strong> ${phone}</p>
            <p><strong>✉️ Email:</strong> ${email}</p>
            <p><strong>🎯 Желание:</strong> ${reason}</p>
            <p><strong>💬 Сообщение:</strong> ${message.replace(/\n/g, '<br>')}</p>
          </div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #ef4444; font-weight: bold;">⚡ Срочно перезвоните клиенту!</p>
        </div>
      `
    });

    console.log('✅ ОТПРАВЛЕНО:', name);
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('🚨 ОШИБКА отправки:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
