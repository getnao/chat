import { IncomingHttpHeaders } from 'node:http';

import * as projectQueries from '../queries/project.queries';

/** Convert fastify headers to basic `Headers` for better-auth. */
export const convertHeaders = (headers: IncomingHttpHeaders) => {
	const convertedHeaders = new Headers();
	for (const [key, value] of Object.entries(headers)) {
		if (value) {
			convertedHeaders.set(key, Array.isArray(value) ? value.join(', ') : value);
		}
	}
	return convertedHeaders;
};

export const isAbortError = (error: unknown): error is Error & { name: 'AbortError' } => {
	return error instanceof Error && error.name === 'AbortError';
};

export const getErrorMessage = (error: unknown): string | null => {
	if (!error) {
		return null;
	}
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
};

export const isEmailDomainAllowed = (userEmail: string) => {
	const googleAuthDomains = process.env.GOOGLE_AUTH_DOMAINS;
	if (googleAuthDomains) {
		const allowedDomains = googleAuthDomains.split(',').map((domain) => domain.trim().toLowerCase());
		const userEmailDomain = userEmail.split('@').at(1)?.toLowerCase();
		if (!userEmailDomain) {
			return false;
		}
		return allowedDomains.includes(userEmailDomain);
	}
	return true;
};

export const regexPassword = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/;

export const checkProjectHasMoreThanOneAdmin = async (projectId: string) => {
	const userWithRoles = await projectQueries.getAllUsersWithRoles(projectId);
	const nbAdmin = userWithRoles.filter((u) => u.role === 'admin').length;
	return nbAdmin > 1;
};
