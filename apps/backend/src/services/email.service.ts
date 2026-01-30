import type { Transporter } from 'nodemailer';
import nodemailer from 'nodemailer';

import type { CreatedEmailData, EmailData, SendEmailParams } from '../types/email';

class EmailService {
	private transporter: Transporter | null = null;
	private enabled: boolean = false;

	constructor() {
		this.initialize();
	}

	private initialize() {
		const { EMAIL_SERVICE, EMAIL_USER, GOOGLE_APP_PASSWORD } = process.env;

		if (!EMAIL_USER || !GOOGLE_APP_PASSWORD) {
			return;
		}

		try {
			this.transporter = nodemailer.createTransport({
				service: EMAIL_SERVICE || 'gmail',
				auth: {
					user: EMAIL_USER,
					pass: GOOGLE_APP_PASSWORD,
				},
			});

			this.enabled = true;
		} catch {
			this.enabled = false;
		}
	}

	async createUserAddedToProjectEmail(data: EmailData): Promise<CreatedEmailData> {
		const { to, userName, projectName, temporaryPassword, loginUrl } = data;

		const isNewUser = !!temporaryPassword;

		const subject = isNewUser
			? `You've been invited to ${projectName} on nao`
			: `You've been added to ${projectName} on nao`;

		const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .credentials { background-color: #fff; padding: 20px; margin: 20px 0; border-left: 4px solid #4F46E5; border-radius: 4px; }
        .info-box { background-color: #fff; padding: 20px; margin: 20px 0; border-left: 4px solid #6B7280; border-radius: 4px; }
        .password { font-family: monospace; font-size: 18px; font-weight: bold; color: #4F46E5; letter-spacing: 2px; }
        .button { display: inline-block; padding: 12px 30px; background-color: #4F46E5; color: white !important; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .warning { background-color: #FEF3C7; padding: 15px; margin: 20px 0; border-left: 4px solid #F59E0B; border-radius: 4px; }
        .footer { text-align: center; margin-top: 30px; color: #6B7280; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="content">
            <p>Hi ${userName},</p>

            <p>${isNewUser ? `You've been invited to join the project <strong>${projectName}</strong> on nao.` : `You've been added to a new project on nao.`}</p>

            ${
				isNewUser
					? `
            <div class="credentials">
                <p><strong>Your login credentials:</strong></p>
                <p>Email: <strong>${to}</strong></p>
                <p>Temporary Password: <span class="password">${temporaryPassword}</span></p>
            </div>

            <div class="warning">
                <strong>⚠️ Important:</strong> You will be required to change this password on your first login for security reasons.
            </div>
            `
					: `
            <div class="info-box">
                <p><strong>Project:</strong> ${projectName}</p>
                <p>You can now access this project using your existing nao account.</p>
            </div>
            `
			}

            <div style="text-align: center;">
                <a href="${loginUrl}" class="button">${'Login to nao'}</a>
            </div>

            <p>If you have any questions${isNewUser ? '' : ' about this project'}, please contact your project administrator.</p>

            <div class="footer">
                <p>This is an automated message from nao.</p>
            </div>
        </div>
    </div>
</body>
</html>
        `.trim();

		const text = isNewUser
			? `
Welcome to nao!

Hi ${userName},

You've been invited to join the project "${projectName}" on nao.

Your login credentials:
Email: ${to}
Temporary Password: ${temporaryPassword}

⚠️ Important: You will be required to change this password on your first login for security reasons.

Login here: ${loginUrl}

If you have any questions, please contact your project administrator.

---
This is an automated message from nao.
        `.trim()
			: `
New Project Access

Hi ${userName},

Great news! You've been added to the project "${projectName}" on nao.

You can now access this project using your existing nao account.

Login here: ${loginUrl}

If you have any questions about this project, please contact your project administrator.

---
This is an automated message from nao.
        `.trim();

		return { subject, html, text };
	}

	async createResetPasswordEmail(data: EmailData): Promise<CreatedEmailData> {
		const { userName, temporaryPassword, loginUrl } = data;

		const subject = 'Your password has been reset on nao';

		const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .credentials { background-color: #fff; padding: 20px; margin: 20px 0; border-left: 4px solid #4F46E5; border-radius: 4px; }
        .password { font-family: monospace; font-size: 18px; font-weight: bold; color: #4F46E5; letter-spacing: 2px; }
        .button { display: inline-block; padding: 12px 30px; background-color: #4F46E5; color: white !important; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .warning { background-color: #FEF3C7; padding: 15px; margin: 20px 0; border-left: 4px solid #F59E0B; border-radius: 4px; }
        .footer { text-align: center; margin-top: 30px; color: #6B7280; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="content">
            <p>Hi ${userName},</p>

            <p>Your password has been reset on nao.</p>

            <div class="credentials">
                <p><strong>Your new temporary password:</strong></p>
                <p class="password">${temporaryPassword}</p>
            </div>

            <div class="warning">
                <strong>⚠️ Important:</strong> You will be required to change this password on your next login for security reasons.
            </div>

            <div style="text-align: center;">
                <a href="${loginUrl}" class="button">Login to nao</a>
            </div>

            <p>If you did not request this password reset, please contact your project administrator immediately.</p>

            <div class="footer">
                <p>This is an automated message from nao.</p>
            </div>
        </div>
    </div>
</body>
</html>
        `.trim();

		const text = `
Password Reset - nao

Hi ${userName},

Your password has been reset by a project administrator.

Your new temporary password: ${temporaryPassword}

⚠️ Important: You will be required to change this password on your next login for security reasons.

Login here: ${loginUrl}

If you did not request this password reset, please contact your project administrator immediately.

---
This is an automated message from nao.
        `.trim();

		return { subject, html, text };
	}

	private async createEmail(data: EmailData, type: 'createUser' | 'resetPassword'): Promise<CreatedEmailData> {
		if (type === 'resetPassword') {
			return await this.createResetPasswordEmail(data);
		} else {
			return await this.createUserAddedToProjectEmail(data);
		}
	}

	public async sendEmail(params: SendEmailParams): Promise<void> {
		if (!this.enabled || !this.transporter) {
			return;
		}

		const { user, projectName, temporaryPassword, type } = params;

		const data = {
			to: user.email,
			userName: user.name,
			projectName: projectName,
			loginUrl: process.env.REDIRECT_URL || 'http://localhost:3000',
			temporaryPassword: temporaryPassword,
		};

		const email = await this.createEmail(data, type);

		try {
			await this.transporter.sendMail({
				from: process.env.EMAIL_USER,
				to: user.email,
				subject: email.subject,
				html: email.html,
				text: email.text,
			});
		} catch (error) {
			console.error(`❌ Failed to send email to ${user.email}:`, error);
		}
	}
}

// Singleton instance of the email service
export const emailService = new EmailService();
