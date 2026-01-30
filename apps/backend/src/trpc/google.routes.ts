import { adminProtectedProcedure, publicProcedure } from './trpc';

export const googleRoutes = {
	isSetup: publicProcedure.query(() => {
		return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
	}),
	getSettings: adminProtectedProcedure.query(() => {
		return {
			clientId: process.env.GOOGLE_CLIENT_ID || '',
			clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
			authDomains: process.env.GOOGLE_AUTH_DOMAINS || '',
		};
	}),
};
