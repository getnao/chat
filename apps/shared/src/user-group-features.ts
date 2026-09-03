export const USER_GROUP_FEATURES = ['stories', 'automations', 'compact-mode'] as const;

export type UserGroupFeature = (typeof USER_GROUP_FEATURES)[number];

export const USER_GROUP_FEATURE_DEFINITIONS: ReadonlyArray<{
	key: UserGroupFeature;
	label: string;
	description: string;
}> = [
	{
		key: 'stories',
		label: 'Stories',
		description: 'Create, view, and manage stories.',
	},
	{
		key: 'automations',
		label: 'Automations',
		description: 'Create, view, and manage automations.',
	},
	{
		key: 'compact-mode',
		label: 'Compact mode',
		description: 'Use the compact chat interface.',
	},
];
