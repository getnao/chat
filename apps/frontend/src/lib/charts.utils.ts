/** Converts a data key to a label */
export const toLabel = (str: any) => {
	return String(str)
		.replace(/_/g, ' ')
		.replace(/\b\w/g, (char) => char.toUpperCase());
};
