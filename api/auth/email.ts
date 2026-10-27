import type { EmailConfig } from '../config.js';

export interface Email {
	to: string;
	subject: string;
	text: string;
}

export type SendEmail = (email: Email) => Promise<void>;

const resendURL = 'https://api.resend.com/emails';

export function createEmailSender(config: EmailConfig | undefined, request = fetch): SendEmail {
	if (!config) {
		return async () => {
			throw new Error(
				'Email delivery is disabled or not configured. Set EMAIL_DELIVERY_ENABLED=true, RESEND_API_KEY and EMAIL_FROM when ready.'
			);
		};
	}
	return async ({ to, subject, text }) => {
		const response = await request(resendURL, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${config.apiKey}`,
				'content-type': 'application/json'
			},
			body: JSON.stringify({ from: config.from, to: [to], subject, text }),
			signal: AbortSignal.timeout(10000)
		});
		if (!response.ok) throw new Error(`Email delivery failed with status ${response.status}.`);
	};
}

export function verificationEmail(to: string, url: string): Email {
	return {
		to,
		subject: 'Verify your Maple email',
		text: `Confirm this email address for your Maple account:\n\n${url}\n\nIf you did not request this, you can ignore this email.`
	};
}

export function resetPasswordEmail(to: string, url: string): Email {
	return {
		to,
		subject: 'Reset your Maple password',
		text: `Reset your Maple password with this link:\n\n${url}\n\nIf you did not request this, you can ignore this email.`
	};
}
