import { NextRequest, NextResponse } from 'next/server';
import * as nodemailer from 'nodemailer';
import { getDbAsync } from '@/lib/db';

interface EmailConfig {
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string;
  fromName?: string;
  adminEmail?: string;
}

/**
 * POST /api/admin/test-email
 * Отправляет тестовое письмо через SMTP.
 *
 * Тело запроса (опционально):
 * {
 *   emailConfig: { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, fromName, adminEmail }
 * }
 * Если emailConfig не передан — берём сохранённые настройки из БД.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const incomingConfig: EmailConfig = body?.emailConfig || {};

    // Настройки SMTP: приоритет — конфиг из формы (тест до сохранения), затем из БД
    const db = await getDbAsync();
    const savedConfig: EmailConfig = db?.emailConfig || {};
    const config: EmailConfig = {
      smtpHost: incomingConfig.smtpHost || savedConfig.smtpHost,
      smtpPort: incomingConfig.smtpPort || savedConfig.smtpPort || 465,
      smtpSecure: incomingConfig.smtpSecure !== undefined ? incomingConfig.smtpSecure : (savedConfig.smtpSecure ?? true),
      smtpUser: incomingConfig.smtpUser || savedConfig.smtpUser,
      smtpPass: incomingConfig.smtpPass || savedConfig.smtpPass,
      fromName: incomingConfig.fromName || savedConfig.fromName || 'Шифу Панда',
      adminEmail: incomingConfig.adminEmail || savedConfig.adminEmail || incomingConfig.smtpUser || savedConfig.smtpUser
    };

    if (!config.smtpUser || !config.smtpPass) {
      return NextResponse.json({ error: 'SMTP не настроен. Укажите email и пароль SMTP.' }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass
      }
    } as any);

    await transporter.sendMail({
      from: `"${config.fromName}" <${config.smtpUser}>`,
      to: config.adminEmail,
      subject: '✅ Тестовое письмо — SMTP настроен верно',
      text: 'Это тестовое письмо из админки сайта «Шифу Панда». Если вы его видите — SMTP работает!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #059669, #10b981); padding: 24px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: #ffffff; margin: 0;">🐼 Тестовое письмо</h1>
          </div>
          <div style="background: #f0fdf4; padding: 24px; border: 1px solid #d1fae5; border-top: none; border-radius: 0 0 16px 16px;">
            <p>Здравствуйте!</p>
            <p>Это тестовое письмо отправлено из <strong>админки сайта «Центр Функционального Развития»</strong>.</p>
            <p>Если вы видите это сообщение — SMTP-настройки работают корректно. 🎉</p>
            <hr style="border: none; border-top: 1px solid #d1fae5; margin: 24px 0;">
            <p style="color: #6b7280; font-size: 14px;">Отправлено: ${new Date().toLocaleString('ru-RU')}</p>
          </div>
        </div>
      `
    });

    console.log('✅ Тестовое письмо отправлено на:', config.adminEmail);
    return NextResponse.json({ success: true, to: config.adminEmail });

  } catch (error: any) {
    console.error('🚨 Ошибка отправки тестового письма:', error.message);
    return NextResponse.json({ error: error.message || 'Ошибка отправки письма' }, { status: 500 });
  }
}