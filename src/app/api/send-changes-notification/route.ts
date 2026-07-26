import { NextRequest, NextResponse } from 'next/server';
import * as nodemailer from 'nodemailer';
import { getDb } from '@/lib/db';

export async function POST(request: NextRequest) {
  const db = getDb();
  const config = db.emailConfig;
  
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: { user: config.smtpUser, pass: config.smtpPass }
  });

  await transporter.sendMail({
    from: `"Админка" <${config.smtpUser}>`,
    to: [/*config.adminEmail,*/ config.errorEmail],
    subject: '🐼 Изменения на сайте',
    html: `
      <h2>🔄 Обнаружены изменения в данных сайта!</h2>

      <p><strong>Время:</strong> ${new Date().toLocaleString('ru-RU')}</p>
      <hr>
      <p>Перейдите в <a href="${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/admin">админку</a> для проверки.</p>
    `
  });

  return NextResponse.json({ success: true });
}
