import type { AnyFieldApi } from '@tanstack/react-form';

export function FormFieldError({ field }: { field: AnyFieldApi }) {
	return (
		<>
			{field.state.meta.isTouched && !field.state.meta.isValid
				? field.state.meta.errors.map((err) => (
						<p className='text-sm text-red-500' key={err.message}>
							{err.message}
						</p>
					))
				: null}
		</>
	);
}
