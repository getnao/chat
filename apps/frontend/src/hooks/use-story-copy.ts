import { marked } from 'marked';
import { useCallback, useState } from 'react';

import { trpcClient } from '@/main';

export interface StoryCopyOptions {
	storyId?: string;
	chatId?: string;
	storySlug?: string;
	shareId?: string;
	shareType?: 'chat' | 'story';
	isOwner?: boolean;
	versionNumber?: number;
}

export function useStoryCopy({
	storyId,
	chatId,
	storySlug,
	shareId,
	shareType = 'story',
	isOwner = true,
	versionNumber,
}: StoryCopyOptions) {
	const [isCopying, setIsCopying] = useState(false);
	const canCopy = isOwner || !!shareId || !!storyId;

	const copyStory = useCallback(async () => {
		if (!canCopy || isCopying) {
			return;
		}
		setIsCopying(true);
		try {
			let result;
			if (storyId) {
				result = await trpcClient.story.downloadStandalone.query({ storyId, format: 'markdown' });
			} else if (isOwner) {
				result = await trpcClient.story.download.query({
					chatId: chatId!,
					storySlug: storySlug!,
					format: 'markdown',
					versionNumber,
				});
			} else if (shareType === 'chat') {
				result = await trpcClient.sharedChat.downloadStory.query({
					shareId: shareId!,
					storySlug: storySlug!,
					format: 'markdown',
					versionNumber,
				});
			} else {
				result = await trpcClient.storyShare.download.query({
					shareId: shareId!,
					format: 'markdown',
					versionNumber,
				});
			}
			const markdown = new TextDecoder().decode(
				Uint8Array.from(atob(result.data), (character) => character.charCodeAt(0)),
			);
			await writeMarkdownToClipboard(markdown);
		} catch (error) {
			console.error('Story copy failed:', error);
		} finally {
			setIsCopying(false);
		}
	}, [canCopy, isCopying, isOwner, storyId, chatId, storySlug, shareId, shareType, versionNumber]);

	return { copyStory, isCopying, canCopy };
}

async function writeMarkdownToClipboard(markdown: string): Promise<void> {
	if (!navigator.clipboard.write || typeof ClipboardItem === 'undefined') {
		await navigator.clipboard.writeText(markdown);
		return;
	}

	const html = sanitizeClipboardHtml(marked.parse(markdown, { async: false, gfm: true }));
	const clipboardItem = new ClipboardItem({
		'text/plain': new Blob([markdown], { type: 'text/plain' }),
		'text/html': new Blob([html], { type: 'text/html' }),
	});

	await navigator.clipboard.write([clipboardItem]);
}

function sanitizeClipboardHtml(html: string): string {
	const document = new DOMParser().parseFromString(html, 'text/html');
	document.querySelectorAll('script, style, iframe, object, embed').forEach((element) => element.remove());

	for (const element of document.body.querySelectorAll('*')) {
		for (const attribute of [...element.attributes]) {
			const value = attribute.value.trim().toLowerCase();
			if (attribute.name.startsWith('on') || value.startsWith('javascript:')) {
				element.removeAttribute(attribute.name);
			}
		}
	}

	return document.body.innerHTML;
}
