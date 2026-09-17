import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CustomLoggerService } from '../../common/logger';
import { EmailConfig } from '../../config/config.interface';
import * as nodemailer from 'nodemailer';
import * as sgMail from '@sendgrid/mail';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private provider: 'smtp' | 'sendgrid';

  constructor(
    private configService: ConfigService,
    private logger: CustomLoggerService,
  ) {
    this.initializeEmailProvider();
  }

  private initializeEmailProvider(): void {
    const emailConfig = this.configService.get<EmailConfig>('email');
    this.provider = emailConfig?.provider || 'smtp';

    if (this.provider === 'sendgrid') {
      this.initializeSendGrid();
    } else {
      this.initializeSMTP();
    }
  }

  private initializeSendGrid(): void {
    const sendgridApiKey = this.configService.get<string>(
      'email.sendgridApiKey',
    );

    if (!sendgridApiKey) {
      this.logger.warn(
        'SendGrid API key not configured, email service will be disabled',
        'EmailService',
      );
      return;
    }

    try {
      sgMail.setApiKey(sendgridApiKey);
      this.logger.info('SendGrid email service initialized successfully', {
        provider: 'sendgrid',
        context: 'EmailService',
      });
    } catch (error: unknown) {
      this.logger.error(
        'Failed to initialize SendGrid email service',
        error instanceof Error
          ? error instanceof Error
            ? error.stack
            : undefined
          : undefined,
        'EmailService',
      );
    }
  }

  private initializeSMTP(): void {
    const emailConfig = this.configService.get<EmailConfig>('email');

    if (!emailConfig?.smtp?.host || !emailConfig?.smtp?.user) {
      this.logger.warn(
        'SMTP configuration incomplete, email service will be disabled',
        'EmailService',
      );
      this.logger.info('Email configuration details', {
        hasHost: !!emailConfig?.smtp?.host,
        hasUser: !!emailConfig?.smtp?.user,
        hasPass: !!emailConfig?.smtp?.pass,
        context: 'EmailService',
      });
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: emailConfig.smtp.host,
        port: emailConfig.smtp.port,
        secure: emailConfig.smtp.secure,
        auth: {
          user: emailConfig.smtp.user,
          pass: emailConfig.smtp.pass,
        },
      });

      this.logger.info('SMTP email service initialized successfully', {
        provider: 'smtp',
        host: emailConfig.smtp.host,
        port: emailConfig.smtp.port,
        secure: emailConfig.smtp.secure,
        user: emailConfig.smtp.user.replace(/(.{2}).*(@.*)/, '$1***$2'),
        context: 'EmailService',
      });
    } catch (error: unknown) {
      this.logger.error(
        'Failed to initialize SMTP email service',
        error instanceof Error
          ? error instanceof Error
            ? error.stack
            : undefined
          : undefined,
        'EmailService',
      );
    }
  }

  async sendOperationalEmail(
    to: string,
    subject: string,
    message: string,
  ): Promise<void> {
    const escaped = message.replace(
      /[&<>"']/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[character]!,
    );
    await this.sendEmail(to, subject, `<p>${escaped}</p>`);
  }

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    const from =
      this.configService.get<string>('email.from') || 'noreply@goldwen.com';

    if (this.provider === 'sendgrid') {
      const msg = {
        to,
        from,
        subject,
        html,
      };

      await sgMail.send(msg);
    } else {
      if (!this.transporter) {
        this.logger.warn('Email service not configured, skipping email');
        return;
      }

      const mailOptions = {
        from,
        to,
        subject,
        html,
      };

      await this.transporter.sendMail(mailOptions);
    }
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn('Email service not configured, skipping welcome email');
      return;
    }

    try {
      await this.sendEmail(
        email,
        'Bienvenue sur GoldWen !',
        this.getWelcomeEmailTemplate(firstName),
      );

      this.logger.info('Welcome email sent successfully', {
        email: this.maskEmail(email),
        provider: this.provider,
      });
    } catch (error: unknown) {
      const errorMessage = this.getEmailErrorMessage(error);
      this.logger.error(
        'Failed to send welcome email',
        error instanceof Error
          ? error instanceof Error
            ? error.stack
            : undefined
          : undefined,
        'EmailService',
      );
      this.logger.info('Welcome email error details', {
        error: errorMessage,
        email: this.maskEmail(email),
        provider: this.provider,
        context: 'EmailService',
      });
      // Don't throw error for welcome email, it's not critical
    }
  }

  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
  ): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Email service not configured, skipping password reset email',
      );
      return;
    }

    try {
      const resetUrl = `${this.configService.get<string>('app.frontendUrl')}/reset-password?token=${resetToken}`;

      await this.sendEmail(
        email,
        'Réinitialisation de votre mot de passe GoldWen',
        this.getPasswordResetEmailTemplate(resetUrl),
      );

      this.logger.info('Password reset email sent successfully', {
        email: this.maskEmail(email),
        provider: this.provider,
      });
    } catch (error: unknown) {
      const errorMessage = this.getEmailErrorMessage(error);
      this.logger.error(
        'Failed to send password reset email',
        error instanceof Error
          ? error instanceof Error
            ? error.stack
            : undefined
          : undefined,
        'EmailService',
      );
      this.logger.info('Password reset email error details', {
        error: errorMessage,
        email: this.maskEmail(email),
        provider: this.provider,
        context: 'EmailService',
      });
      throw error;
    }
  }

  async sendDataExportReadyEmail(
    email: string,
    firstName: string,
    downloadUrl: string,
  ): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Email service not configured, skipping data export email',
      );
      return;
    }

    try {
      await this.sendEmail(
        email,
        'Votre export de données est prêt',
        this.getDataExportReadyTemplate(firstName, downloadUrl),
      );

      this.logger.info('Data export ready email sent successfully', {
        email: this.maskEmail(email),
        provider: this.provider,
      });
    } catch (error: unknown) {
      const errorMessage = this.getEmailErrorMessage(error);
      this.logger.error(
        'Failed to send data export ready email',
        error instanceof Error
          ? error instanceof Error
            ? error.stack
            : undefined
          : undefined,
        'EmailService',
      );
      this.logger.info('Data export ready email error details', {
        error: errorMessage,
        email: this.maskEmail(email),
        provider: this.provider,
        context: 'EmailService',
      });
      throw error;
    }
  }

  async sendAccountDeletedEmail(
    email: string,
    firstName: string,
  ): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Email service not configured, skipping account deleted email',
      );
      return;
    }

    try {
      await this.sendEmail(
        email,
        'Votre compte GoldWen a été supprimé',
        this.getAccountDeletedTemplate(firstName),
      );

      this.logger.info('Account deleted email sent successfully', {
        email: this.maskEmail(email),
        provider: this.provider,
      });
    } catch (error: unknown) {
      const errorMessage = this.getEmailErrorMessage(error);
      this.logger.error(
        'Failed to send account deleted email',
        error instanceof Error
          ? error instanceof Error
            ? error.stack
            : undefined
          : undefined,
        'EmailService',
      );
      this.logger.info('Account deleted email error details', {
        error: errorMessage,
        email: this.maskEmail(email),
        provider: this.provider,
        context: 'EmailService',
      });
      // Don't throw error for account deleted email, account is already deleted
    }
  }

  async sendSubscriptionConfirmedEmail(
    email: string,
    firstName: string,
    subscriptionType: string,
    expiryDate: Date,
  ): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Email service not configured, skipping subscription confirmed email',
      );
      return;
    }

    try {
      await this.sendEmail(
        email,
        'Votre abonnement GoldWen est confirmé',
        this.getSubscriptionConfirmedTemplate(
          firstName,
          subscriptionType,
          expiryDate,
        ),
      );

      this.logger.info('Subscription confirmed email sent successfully', {
        email: this.maskEmail(email),
        provider: this.provider,
        subscriptionType,
      });
    } catch (error: unknown) {
      const errorMessage = this.getEmailErrorMessage(error);
      this.logger.error(
        'Failed to send subscription confirmed email',
        error instanceof Error
          ? error instanceof Error
            ? error.stack
            : undefined
          : undefined,
        'EmailService',
      );
      this.logger.info('Subscription confirmed email error details', {
        error: errorMessage,
        email: this.maskEmail(email),
        provider: this.provider,
        subscriptionType,
        context: 'EmailService',
      });
      // Don't throw error for subscription confirmed email
    }
  }

  private isConfigured(): boolean {
    if (this.provider === 'sendgrid') {
      return !!this.configService.get<string>('email.sendgridApiKey');
    }
    return !!this.transporter;
  }

  private maskEmail(email: string): string {
    return email.replace(/(.{2}).*(@.*)/, '$1***$2');
  }

  private getEmailErrorMessage(error: unknown): string {
    // SendGrid rejects with an Error subclass that carries `code` and a
    // `response.body` payload; a plain SMTP/nodemailer failure is a bare
    // Error. Narrow instead of trusting the shape blindly.
    const sgError = error as
      | {
          code?: string | number;
          message?: string;
          response?: { body?: unknown };
        }
      | undefined;

    const errorMsg =
      (error instanceof Error
        ? error instanceof Error
          ? error.message
          : String(error)
        : undefined) ||
      (typeof error === 'string' ? error : undefined) ||
      'Unknown error';

    // SendGrid specific errors
    if (sgError?.code || sgError?.response?.body) {
      return `SendGrid API error: ${errorMsg}. Code: ${sgError?.code ?? 'unknown'}`;
    }

    // SMTP/Gmail authentication errors
    if (
      errorMsg.includes('Username and Password not accepted') ||
      errorMsg.includes('BadCredentials')
    ) {
      return (
        `Gmail authentication failed. Please ensure you are using an App Password instead of your regular password. ` +
        `Visit https://support.google.com/accounts/answer/185833 to create an App Password. ` +
        `Original error: ${errorMsg}`
      );
    }

    if (errorMsg.includes('Invalid login')) {
      return (
        `Email login failed. Please check your email credentials and ensure 2FA is properly configured. ` +
        `For Gmail users, use App Passwords instead of regular passwords. ` +
        `Original error: ${errorMsg}`
      );
    }

    return errorMsg;
  }

  private getBaseEmailTemplate(content: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            max-width: 600px; 
            margin: 0 auto; 
            padding: 0;
            background-color: #f5f5f5;
          }
          .email-container {
            background: #ffffff;
            margin: 20px auto;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .header { 
            background: linear-gradient(135deg, #D4AF37 0%, #F4E4A1 100%); 
            padding: 40px 30px; 
            text-align: center; 
            color: white; 
          }
          .header h1 {
            margin: 0 0 10px 0;
            font-size: 32px;
            font-weight: 600;
          }
          .header p {
            margin: 0;
            font-size: 16px;
            opacity: 0.95;
          }
          .content { 
            padding: 40px 30px; 
            background: #ffffff;
            color: #333333;
            line-height: 1.6;
          }
          .content h2 {
            color: #D4AF37;
            margin-top: 0;
            font-size: 24px;
          }
          .content p {
            margin: 15px 0;
            font-size: 15px;
          }
          .content ul {
            padding-left: 20px;
          }
          .content li {
            margin: 10px 0;
            font-size: 15px;
          }
          .button { 
            display: inline-block; 
            padding: 15px 35px; 
            background: #D4AF37; 
            color: white !important; 
            text-decoration: none; 
            border-radius: 6px; 
            margin: 20px 0;
            font-weight: 600;
            font-size: 16px;
            text-align: center;
          }
          .button:hover {
            background: #C4A027;
          }
          .footer { 
            padding: 30px; 
            text-align: center; 
            color: #999; 
            font-size: 13px;
            background: #f9f9f9;
            border-top: 1px solid #eeeeee;
          }
          .footer p {
            margin: 5px 0;
          }
          @media only screen and (max-width: 600px) {
            .email-container {
              margin: 0;
              border-radius: 0;
            }
            .header, .content, .footer {
              padding: 25px 20px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          ${content}
        </div>
      </body>
      </html>
    `;
  }

  private getWelcomeEmailTemplate(firstName: string): string {
    const content = `
      <div class="header">
        <h1>GoldWen</h1>
        <p>Bienvenue dans l'expérience de rencontre intentionnelle</p>
      </div>
      <div class="content">
        <h2>Bonjour ${firstName},</h2>
        <p>Félicitations ! Vous venez de rejoindre GoldWen, l'application de rencontre qui privilégie la qualité à la quantité.</p>
        <p>Voici ce qui vous attend :</p>
        <ul>
          <li>🌟 Une sélection quotidienne de profils compatibles</li>
          <li>💬 Des conversations authentiques et limitées dans le temps</li>
          <li>🎯 Un algorithme qui apprend vos préférences</li>
          <li>✨ Une expérience conçue pour vous faire rencontrer LA bonne personne</li>
        </ul>
        <p>Votre prochaine sélection arrive demain à midi. Préparez-vous pour des rencontres exceptionnelles !</p>
      </div>
      <div class="footer">
        <p>© 2025 GoldWen. Tous droits réservés.</p>
        <p>Conçue pour être désinstallée 💛</p>
      </div>
    `;
    return this.getBaseEmailTemplate(content);
  }

  private getPasswordResetEmailTemplate(resetUrl: string): string {
    const content = `
      <div class="header">
        <h1>GoldWen</h1>
        <p>Réinitialisation de votre mot de passe</p>
      </div>
      <div class="content">
        <h2>Bonjour,</h2>
        <p>Vous avez demandé la réinitialisation de votre mot de passe GoldWen.</p>
        <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
        <p style="text-align: center;">
          <a href="${resetUrl}" class="button">Réinitialiser mon mot de passe</a>
        </p>
        <p>Ce lien expirera dans 1 heure.</p>
        <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email. Votre mot de passe actuel restera inchangé.</p>
      </div>
      <div class="footer">
        <p>© 2025 GoldWen. Tous droits réservés.</p>
      </div>
    `;
    return this.getBaseEmailTemplate(content);
  }

  private getDataExportReadyTemplate(
    firstName: string,
    downloadUrl: string,
  ): string {
    const content = `
      <div class="header">
        <h1>GoldWen</h1>
        <p>Votre export de données est prêt</p>
      </div>
      <div class="content">
        <h2>Bonjour ${firstName},</h2>
        <p>Votre export de données personnelles est maintenant disponible et prêt à être téléchargé.</p>
        <p>Cet export contient toutes les données que nous avons collectées sur votre compte, conformément au RGPD.</p>
        <p style="text-align: center;">
          <a href="${downloadUrl}" class="button">Télécharger mes données</a>
        </p>
        <p><strong>Important :</strong> Ce lien expirera dans 7 jours pour des raisons de sécurité.</p>
        <p>Si vous n'avez pas demandé cet export, veuillez nous contacter immédiatement.</p>
      </div>
      <div class="footer">
        <p>© 2025 GoldWen. Tous droits réservés.</p>
        <p>Nous respectons votre vie privée et vos données.</p>
      </div>
    `;
    return this.getBaseEmailTemplate(content);
  }

  private getAccountDeletedTemplate(firstName: string): string {
    const content = `
      <div class="header">
        <h1>GoldWen</h1>
        <p>Confirmation de suppression de compte</p>
      </div>
      <div class="content">
        <h2>Au revoir ${firstName},</h2>
        <p>Nous confirmons que votre compte GoldWen a été définitivement supprimé, conformément à votre demande.</p>
        <p><strong>Vos données ont été supprimées :</strong></p>
        <ul>
          <li>Informations de profil</li>
          <li>Photos et médias</li>
          <li>Historique de conversations</li>
          <li>Préférences et paramètres</li>
        </ul>
        <p>Nous sommes tristes de vous voir partir, mais nous espérons que vous avez trouvé ce que vous cherchiez.</p>
        <p>Si vous avez des questions ou souhaitez nous faire part de vos commentaires, n'hésitez pas à nous contacter.</p>
        <p>Vous serez toujours le bienvenu si vous décidez de revenir ! 💛</p>
      </div>
      <div class="footer">
        <p>© 2025 GoldWen. Tous droits réservés.</p>
        <p>Merci d'avoir fait partie de notre communauté.</p>
      </div>
    `;
    return this.getBaseEmailTemplate(content);
  }

  private getSubscriptionConfirmedTemplate(
    firstName: string,
    subscriptionType: string,
    expiryDate: Date,
  ): string {
    const formattedDate = expiryDate.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const benefits: Record<string, string[]> = {
      'GoldWen Plus': [
        "Jusqu'à 3 choix par jour au lieu d'un seul",
        'Voir qui vous a choisi avant de décider',
        'Filtres de recherche avancés',
        'Support prioritaire',
      ],
      'GoldWen Premium': [
        'Tous les avantages de GoldWen Plus',
        'Choix illimités chaque jour',
        'Conversations illimitées',
        'Badge vérifié sur votre profil',
      ],
    };

    const subscriptionBenefits: string[] =
      benefits[subscriptionType] || benefits['GoldWen Plus'];

    const content = `
      <div class="header">
        <h1>GoldWen</h1>
        <p>Bienvenue dans ${subscriptionType} !</p>
      </div>
      <div class="content">
        <h2>Félicitations ${firstName} ! 🎉</h2>
        <p>Votre abonnement <strong>${subscriptionType}</strong> est maintenant actif.</p>
        <p><strong>Vos nouveaux avantages :</strong></p>
        <ul>
          ${subscriptionBenefits.map((benefit: string) => `<li>${benefit}</li>`).join('')}
        </ul>
        <p><strong>Détails de votre abonnement :</strong></p>
        <ul>
          <li>Type : ${subscriptionType}</li>
          <li>Date de renouvellement : ${formattedDate}</li>
        </ul>
        <p>Profitez pleinement de votre expérience GoldWen améliorée !</p>
        <p>Vous pouvez gérer votre abonnement à tout moment depuis les paramètres de votre profil.</p>
      </div>
      <div class="footer">
        <p>© 2025 GoldWen. Tous droits réservés.</p>
        <p>Merci de nous faire confiance pour votre recherche de l'amour.</p>
      </div>
    `;
    return this.getBaseEmailTemplate(content);
  }
}
