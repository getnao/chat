import * as z from 'zod';

export const USER_VALIDATION_SCHEMA = z.object({
	name: z.string().min(2, 'Name must be at least 2 characters'),
	email: z.email('Invalid email address'),
});

export const USER_FORM_INITIAL_VALUES = {
	name: '',
	email: '',
};

export const CREATE_USER_TEXT = {
	TITLE: 'Create User',
	EMAIL_PLACEHOLDER: 'Enter the email address',
	NAME_PLACEHOLDER: 'Enter the name',
};
