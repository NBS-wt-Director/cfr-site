declare module 'nodemailer' {
  export interface Transporter {
    sendMail(options: SendMailOptions): Promise<SentMessageInfo>;
  }

  export interface SendMailOptions {
    from?: string;
    to?: string | string[];
    subject?: string;
    text?: string;
    html?: string;
    attachments?: Attachment[];
    [key: string]: any;
  }

  export interface Attachment {
    filename?: string;
    content?: string | Buffer;
    path?: string;
    contentType?: string;
  }

  export interface SentMessageInfo {
    messageId: string;
    accepted: string[];
    rejected: string[];
  }

  export function createTransport(config: any): Transporter;
}
