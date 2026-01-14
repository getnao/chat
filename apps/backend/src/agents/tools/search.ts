import fs from 'fs/promises';
import { glob } from 'glob';
import path from 'path';
import { getProjectFolder, isWithinProjectFolder, toVirtualPath } from '../../utils/tools';

export const search = async (file_pattern: string) => {
	const projectFolder = getProjectFolder();

	// Sanitize pattern to prevent escaping project folder
	if (path.isAbsolute(file_pattern)) {
		throw new Error(`Access denied: absolute paths are not allowed in file patterns`);
	}
	if (file_pattern.includes('..')) {
		throw new Error(`Access denied: '..' is not allowed in file patterns`);
	}

	// Make pattern recursive if not already
	const pattern = file_pattern.startsWith('**/') ? file_pattern : `**/${file_pattern}`;

	const files = await glob(pattern, { absolute: true, cwd: projectFolder });

	// Filter to only files within the project folder (safety net)
	const safeFiles = files.filter((f) => isWithinProjectFolder(f, projectFolder));

	return await Promise.all(
		safeFiles.map(async (realPath) => {
			const stats = await fs.stat(realPath);
			const virtualPath = toVirtualPath(realPath, projectFolder);

			return {
				path: virtualPath,
				dir: path.dirname(virtualPath),
				size: stats.size.toString(),
			};
		}),
	);
};
