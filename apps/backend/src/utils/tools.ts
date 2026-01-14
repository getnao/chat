import path from 'path';

/**
 * Gets the resolved project folder path from the NAO_PROJECT_FOLDER environment variable.
 * @throws Error if NAO_PROJECT_FOLDER is not set
 */
export const getProjectFolder = (): string => {
	const projectFolder = process.env.NAO_PROJECT_FOLDER;
	if (!projectFolder) {
		throw new Error('NAO_PROJECT_FOLDER environment variable is not set');
	}
	return path.resolve(projectFolder);
};

/**
 * Checks if a given path is within the project folder.
 */
export const isWithinProjectFolder = (filePath: string, projectFolder: string): boolean => {
	const resolved = path.resolve(filePath);
	return resolved === projectFolder || resolved.startsWith(projectFolder + path.sep);
};

/**
 * Converts a virtual path (where / = project folder) to a real filesystem path.
 * - `/foo/bar` → `{projectFolder}/foo/bar`
 * - `foo/bar` → `{projectFolder}/foo/bar`
 * - `/` or empty → `{projectFolder}`
 * @throws Error if the resolved path escapes the project folder
 */
export const toRealPath = (virtualPath: string, projectFolder: string): string => {
	// Strip leading slash to make it relative to project folder
	const relativePath = virtualPath.startsWith('/') ? virtualPath.slice(1) : virtualPath;

	// Resolve and normalize (this handles .. and .)
	const resolvedPath = path.resolve(projectFolder, relativePath);

	// Security check: ensure we haven't escaped
	if (!isWithinProjectFolder(resolvedPath, projectFolder)) {
		throw new Error(`Access denied: path '${virtualPath}' is outside the project folder`);
	}

	return resolvedPath;
};

/**
 * Converts a real filesystem path to a virtual path (where / = project folder).
 * - `{projectFolder}/foo/bar` → `/foo/bar`
 * - `{projectFolder}` → `/`
 * @throws Error if the path is outside the project folder
 */
export const toVirtualPath = (realPath: string, projectFolder: string): string => {
	const resolved = path.resolve(realPath);

	if (!isWithinProjectFolder(resolved, projectFolder)) {
		throw new Error(`Path '${realPath}' is outside the project folder`);
	}

	if (resolved === projectFolder) {
		return '/';
	}

	const relativePath = path.relative(projectFolder, resolved);
	return '/' + relativePath;
};
