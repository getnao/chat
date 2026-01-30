import { useEffect, useState } from 'react';
import { useForm, revalidateLogic } from '@tanstack/react-form';
import { CREATE_USER_TEXT, USER_FORM_INITIAL_VALUES, USER_VALIDATION_SCHEMA } from './constants';
import type { ModifyUserInfoProps } from './types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useCreateUser } from '@/queries/useUsersQuery';
import { COMMON_TEXT } from '@/components/constants';
import { FormFieldError } from '@/components/commons/form-field-error';

export function CreateUser({ open, onOpenChange, onUserCreated }: ModifyUserInfoProps) {
	const [formError, setFormError] = useState<string | null>(null);

	const { mutate: createUser } = useCreateUser();

	const { TITLE, EMAIL_PLACEHOLDER, NAME_PLACEHOLDER } = CREATE_USER_TEXT;
	const { NAME, EMAIL, SAVE_BUTTON } = COMMON_TEXT;

	const form = useForm({
		defaultValues: USER_FORM_INITIAL_VALUES,
		validationLogic: revalidateLogic(),
		validators: {
			onDynamic: USER_VALIDATION_SCHEMA,
		},
		onSubmit: ({ value }) => {
			setFormError(null);

			createUser(
				{
					name: value.name,
					email: value.email,
				},
				{
					onSuccess: (ctx) => {
						onOpenChange(false);
						onUserCreated(value.email, ctx.password);
						form.reset();
					},
					onError: (err: any) => {
						setFormError(err.message);
					},
				},
			);
		},
	});

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		form.handleSubmit();
	};

	useEffect(() => {
		if (!open) {
			setFormError(null);
			form.reset();
		}
	}, [open, form]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{TITLE}</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit} className='flex flex-col gap-4'>
					{formError && <div className='rounded bg-red-50 p-2 text-sm text-red-600'>{formError}</div>}

					<form.Field
						name='name'
						children={(field) => (
							<div className='flex flex-col gap-2'>
								<label htmlFor={field.name} className='text-sm font-medium text-slate-700'>
									{NAME}
								</label>
								<Input
									id={field.name}
									name={field.name}
									type='text'
									placeholder={NAME_PLACEHOLDER}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
								/>
								<FormFieldError field={field} />
							</div>
						)}
					/>
					<form.Field
						name='email'
						children={(field) => (
							<div className='flex flex-col gap-2'>
								<label htmlFor={field.name} className='text-sm font-medium text-slate-700'>
									{EMAIL}
								</label>
								<Input
									id={field.name}
									name={field.name}
									type='email'
									placeholder={EMAIL_PLACEHOLDER}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
								/>
								<FormFieldError field={field} />
							</div>
						)}
					/>
					<form.Subscribe
						selector={(state) => [state.canSubmit, state.isSubmitting]}
						children={([canSubmit, isSubmitting]) => (
							<div className='flex justify-end'>
								<Button type='submit' disabled={!canSubmit || isSubmitting}>
									{SAVE_BUTTON}
								</Button>
							</div>
						)}
					/>
				</form>
			</DialogContent>
		</Dialog>
	);
}
