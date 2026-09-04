export const USER_GROUP_FEATURES = ['story-creation', 'automations', 'compact-mode'] as const;

export type UserGroupFeature = (typeof USER_GROUP_FEATURES)[number];

export const USER_GROUP_FEATURE_DEFINITIONS: ReadonlyArray<{
	key: UserGroupFeature;
	label: string;
	description: string;
}> = [
	{
		key: 'story-creation',
		label: 'Create stories',
		description: 'Create new Stories with the agent or Story mode.',
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

export function normalizeUserGroupFeatures(features: readonly string[]): UserGroupFeature[] {
	return [
		...new Set(
			features
				.map((feature) => (feature === 'stories' ? 'story-creation' : feature))
				.filter((feature): feature is UserGroupFeature =>
					USER_GROUP_FEATURES.includes(feature as UserGroupFeature),
				),
		),
	];
}
