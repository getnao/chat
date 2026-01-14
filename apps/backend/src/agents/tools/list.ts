import fs from 'fs/promises';
import path from 'path';

import { getProjectFolder, toRealPath, toVirtualPath } from '../../utils/tools';

export const list = async (dir_path: string) => {
	const projectFolder = getProjectFolder();
	const realPath = toRealPath(dir_path, projectFolder);

	const entries = await fs.readdir(realPath, { withFileTypes: true });

	return await Promise.all(
		entries.map(async (entry) => {
			const fullRealPath = path.join(realPath, entry.name);

			const type: 'file' | 'directory' | 'symbolic_link' | undefined = entry.isDirectory()
				? 'directory'
				: entry.isFile()
					? 'file'
					: entry.isSymbolicLink()
						? 'symbolic_link'
						: undefined;
			const size = type === 'directory' ? undefined : (await fs.stat(fullRealPath)).size.toString();

			return {
				path: toVirtualPath(fullRealPath, projectFolder),
				name: entry.name,
				type,
				size,
			};
		}),
	);
};
