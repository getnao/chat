import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { UserGroupFeature } from '@nao/shared';

import type { EffectiveUserGroupFeatures } from '@/lib/effective-user-group-features';
import { getActiveProjectId } from '@/lib/active-project';
import { getRenderableUserGroupFeatures } from '@/lib/effective-user-group-features';
import { trpc } from '@/main';

export function useEffectiveUserGroupFeatures() {
	const project = useQuery(trpc.project.getCurrent.queryOptions());
	const activeProjectId = getActiveProjectId();
	const hasCurrentProject = Boolean(project.data?.id) && (!activeProjectId || project.data?.id === activeProjectId);
	const query = useQuery({
		...trpc.userGroup.effectiveFeatures.queryOptions(),
		enabled: hasCurrentProject,
	});
	const isLoading = project.isPending || (hasCurrentProject && (query.isPending || query.isFetching));
	const isError = project.isError || query.isError;
	const features = getRenderableUserGroupFeatures(
		query.data as EffectiveUserGroupFeatures | undefined,
		hasCurrentProject && !isLoading && !isError,
	);
	const isFeatureEnabled = useCallback((feature: UserGroupFeature) => features[feature], [features]);

	return {
		features,
		storiesEnabled: features.stories,
		automationsEnabled: features.automations,
		compactModeEnabled: features['compact-mode'],
		isFeatureEnabled,
		isLoading,
		isError,
	};
}
