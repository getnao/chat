import type { UserGroupFeature } from '@nao/shared';

export type EffectiveUserGroupFeatures = Record<UserGroupFeature, boolean>;

const DENIED_FEATURES: EffectiveUserGroupFeatures = {
	stories: false,
	automations: false,
	'compact-mode': false,
};

export function getRenderableUserGroupFeatures(
	features: EffectiveUserGroupFeatures | undefined,
	isAvailable: boolean,
): EffectiveUserGroupFeatures {
	return isAvailable && features ? features : DENIED_FEATURES;
}
