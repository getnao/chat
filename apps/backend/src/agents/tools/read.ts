import fs from 'fs/promises';
import { getProjectFolder, toRealPath } from '../../utils/tools';

export const read = async (file_path: string) => {
	const projectFolder = getProjectFolder();
	const realPath = toRealPath(file_path, projectFolder);

	const content = await fs.readFile(realPath, 'utf-8');
	const numberOfTotalLines = content.split('\n').length;

	return {
		content,
		numberOfTotalLines,
	};
};
