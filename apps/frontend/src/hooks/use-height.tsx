import { useEffect, useState } from 'react';

export const useHeight = (ref: React.RefObject<HTMLElement | null>, deps: React.DependencyList = []) => {
	const [height, setHeight] = useState(0);

	useEffect(() => {
		if (!ref.current) {
			return;
		}

		const observer = new ResizeObserver((entries) => {
			const entry = entries.at(0);
			if (entry) {
				const entryHeight = entry.target.getBoundingClientRect().height;
				setHeight(entryHeight);
			}
		});

		observer.observe(ref.current);

		return () => observer.disconnect();
	}, [ref, ...deps]); // eslint-disable-line

	return height;
};
