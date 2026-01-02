import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({});

export const { useSession, signIn, signUp, signOut } = authClient;

// Find a solution for Google and GitHub auth or delete this section
// const handleGoogleSignIn = async () => {
// 	await authClient.signIn.social({
// 		provider: 'google',
// 	});
// };

// const handleGitHubSignIn = async () => {
// 	await authClient.signIn.social({
// 		provider: 'github',
// 	});
// };

// export { handleGoogleSignIn, handleGitHubSignIn };
