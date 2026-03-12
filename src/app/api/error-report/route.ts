import { NextRequest, NextResponse } from 'next/server';
import * as nodemailer from 'nodemailer';
import { loadDb } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const errorData = await request.json();

    // Загружаем настройки из БД
    const db = loadDb();
    const config = db.emailConfig;
    
    if (!config?.smtpUser || !config?.smtpPass) {
      console.error('🚨 Email config не найден в БД');
      return NextResponse.json({ success: false }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass
      }
    });

    const subject = errorData.type === '404_NOT_FOUND' 
      ? '🚫 404 - Страница не найдена' 
      : '💥 500 - Критическая ошибка сервера';

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #dc2626; font-size: 24px;">${subject}</h1>
        <div style="background: #fee2e2; padding: 24px; border-radius: 12px; border-left: 5px solid #dc2626; margin: 20px 0;">
          <h3 style="color: #dc2626; margin-top: 0;">📊 Детали ошибки:</h3>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Тип:</strong> ${errorData.type}</li>
            <li><strong>URL:</strong> <a href="${errorData.url}" style="color: #3b82f6;">${errorData.url}</a></li>
            <li><strong>Время:</strong> ${new Intl.DateTimeFormat('ru-RU', { 
              year: 'numeric', month: 'long', day: 'numeric', 
              hour: '2-digit', minute: '2-digit', second: '2-digit' 
            }).format(new Date(errorData.timestamp))}</li>
            <li><strong>User-Agent:</strong> ${errorData.userAgent?.substring(0, 100) || 'Неизвестно'}...</li>
            ${errorData.message ? `<li><strong>Сообщение:</strong> ${errorData.message}</li>` : ''}
            ${errorData.digest ? `<li><strong>Digest:</strong> ${errorData.digest}</li>` : ''}
            ${errorData.stack ? `<li><strong>Stack:</strong> <pre style="background: #f3f4f6; padding: 10px; border-radius: 6px; font-size: 12px; max-height: 200px; overflow: auto;">${errorData.stack.substring(0, 1000)}</pre></li>` : ''}
          </ul>
        </div>
        <p><strong>Referrer:</strong> ${errorData.referrer || 'Прямой доступ'}</p>
        <p><strong>Язык:</strong> ${errorData.language || 'Неизвестно'}</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Shifu Panda Errors" <${config.smtpUser}>`,
      to: config.errorEmail,
      subject,
      html: htmlContent
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ошибка отправки error-report:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
