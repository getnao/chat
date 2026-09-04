import { USER_GROUP_FEATURES, type UserGroupFeature } from '@nao/shared';

import { resolveEffectiveUserGroupFeatures } from '../queries/user-group.queries';
import { HandlerError } from '../utils/error';
import { hasFeature, LICENSE_FEATURES } from './license.service';

export type UserGroupFeatureFlags = Record<UserGroupFeature, boolean>;

export class UserGroupFeatureAccessError extends HandlerError {
	constructor(feature: UserGroupFeature) {
		super('FORBIDDEN', `${featureLabel(feature)} is not enabled for your user group.`);
		this.name = 'UserGroupFeatureAccessError';
	}
}

export async function getEffectiveUserGroupFeatures(projectId: string, userId: string): Promise<UserGroupFeature[]> {
	if (!(await hasFeature(LICENSE_FEATURES.userGroups))) {
		return [...USER_GROUP_FEATURES];
	}
	return resolveEffectiveUserGroupFeatures(projectId, userId);
}

export async function getEffectiveUserGroupFeatureFlags(
	projectId: string,
	userId: string,
): Promise<UserGroupFeatureFlags> {
	const effectiveFeatures = new Set(await getEffectiveUserGroupFeatures(projectId, userId));
	return Object.fromEntries(
		USER_GROUP_FEATURES.map((feature) => [feature, effectiveFeatures.has(feature)]),
	) as UserGroupFeatureFlags;
}

export async function hasUserGroupFeature(
	projectId: string,
	userId: string,
	feature: UserGroupFeature,
): Promise<boolean> {
	const effectiveFeatures = await getEffectiveUserGroupFeatures(projectId, userId);
	return effectiveFeatures.includes(feature);
}

export async function assertUserGroupFeature(
	projectId: string,
	userId: string,
	feature: UserGroupFeature,
): Promise<void> {
	if (!(await hasUserGroupFeature(projectId, userId, feature))) {
		throw new UserGroupFeatureAccessError(feature);
	}
}

function featureLabel(feature: UserGroupFeature): string {
	switch (feature) {
		case 'story-creation':
			return 'Story creation';
		case 'automations':
			return 'Automations';
		case 'compact-mode':
			return 'Compact mode';
	}
}
