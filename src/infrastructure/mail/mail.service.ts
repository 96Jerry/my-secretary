import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';

import { EnvironmentVariables } from '../../config';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter!: Transporter;

  constructor(private readonly env: EnvironmentVariables) {}

  onModuleInit(): void {
    this.transporter = createTransport({
      host: this.env.MAIL_HOST,
      port: this.env.MAIL_PORT,
      secure: false,
      auth: {
        user: this.env.MAIL_USER,
        pass: this.env.MAIL_PASSWORD,
      },
    });
  }

  async send(options: SendMailOptions): Promise<void> {
    await this.transporter.sendMail({
      from: this.env.MAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    this.logger.log(`Mail sent to ${options.to}`);
  }
}
