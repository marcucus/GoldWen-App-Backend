import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CustomLoggerService } from './logger';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(
    private configService: ConfigService,
    private logger: CustomLoggerService,
  ) {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    const emailConfig = this.configService.get('email');

    if (!emailConfig?.smtp?.host || !emailConfig?.smtp?.user) {
      this.logger.warn(
        'Email configuration incomplete, email service will be disabled',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: emailConfig.smtp.host,
      port: emailConfig.smtp.port,
      secure: emailConfig.smtp.secure,
      auth: {
        user: emailConfig.smtp.user,
        pass: emailConfig.smtp.pass,
      },
    });
  }

  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        'Email service not configured, skipping password reset email',
      );
      return;
    }

    try {
      const resetUrl = `${this.configService.get('app.frontendUrl')}/reset-password?token=${resetToken}`;

      const mailOptions = {
        from: this.configService.get('email.from') || 'noreply@goldwen.com',
        to: email,
        subject: 'Réinitialisation de votre mot de passe GoldWen',
        html: this.getPasswordResetEmailTemplate(resetUrl),
      };

      await this.transporter.sendMail(mailOptions);

      this.logger.info('Password reset email sent successfully', {
        email: email.replace(/(.{2}).*(@.*)/, '$1***$2'), // Mask email for privacy
      });
    } catch (error) {
      this.logger.error(
        'Failed to send password reset email',
        error.stack,
        'EmailService',
      );
      throw error;
    }
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('Email service not configured, skipping welcome email');
      return;
    }

    try {
      const mailOptions = {
        from: this.configService.get('email.from') || 'noreply@goldwen.com',
        to: email,
        subject: 'Bienvenue sur GoldWen !',
        html: this.getWelcomeEmailTemplate(firstName),
      };

      await this.transporter.sendMail(mailOptions);

      this.logger.info('Welcome email sent successfully', {
        email: email.replace(/(.{2}).*(@.*)/, '$1***$2'),
      });
    } catch (error) {
      this.logger.error(
        'Failed to send welcome email',
        error.stack,
        'EmailService',
      );
      // Don't throw error for welcome email, it's not critical
    }
  }

  private getPasswordResetEmailTemplate(resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Réinitialisation de mot de passe</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #D4AF37 0%, #F4E4A1 100%); padding: 30px; text-align: center; color: white; }
          .content { padding: 30px; background: #f9f9f9; }
          .button { display: inline-block; padding: 15px 30px; background: #D4AF37; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>GoldWen</h1>
          <p>Réinitialisation de votre mot de passe</p>
        </div>
        <div class="content">
          <h2>Bonjour,</h2>
          <p>Vous avez demandé la réinitialisation de votre mot de passe GoldWen.</p>
          <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
          <a href="${resetUrl}" class="button">Réinitialiser mon mot de passe</a>
          <p>Ce lien expirera dans 1 heure.</p>
          <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
        </div>
        <div class="footer">
          <p>© 2025 GoldWen. Tous droits réservés.</p>
        </div>
      </body>
      </html>
    `;
  }

  private getWelcomeEmailTemplate(firstName: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Bienvenue sur GoldWen</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #D4AF37 0%, #F4E4A1 100%); padding: 30px; text-align: center; color: white; }
          .content { padding: 30px; background: #f9f9f9; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
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
        </div>
      </body>
      </html>
    `;
  }
}
