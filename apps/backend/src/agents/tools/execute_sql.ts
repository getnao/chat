import { getProjectFolder } from '../../utils/tools';

export const execute_sql = async (query: string, databaseId?: string) => {
	const naoProjectFolder = getProjectFolder();

	const response = await fetch(`${process.env.FASTAPI_URL}/execute_sql`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			sql: query,
			nao_project_folder: naoProjectFolder,
			...(databaseId && { database_id: databaseId }),
		}),
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({ detail: response.statusText }));
		throw new Error(`Error executing SQL query: ${JSON.stringify(errorData.detail)}`);
	}

	return response.json();
};
