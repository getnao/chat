import { redirect } from '@tanstack/react-router';
import type { UserGroupFeature } from '@nao/shared';

import { queryClient, trpc } from '@/main';

export async function requireUserGroupFeature(feature: UserGroupFeature) {
	const access = await queryClient.ensureQueryData(trpc.userGroup.effectiveAccess.queryOptions());
	if (!access.features[feature]) {
		throw redirect({ to: '/' });
	}
}
