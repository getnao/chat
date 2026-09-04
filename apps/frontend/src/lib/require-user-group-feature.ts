import { redirect } from '@tanstack/react-router';
import type { UserGroupFeature } from '@nao/shared';

import { queryClient, trpc } from '@/main';

export async function requireUserGroupFeature(feature: UserGroupFeature) {
	const features = await queryClient.ensureQueryData(trpc.userGroup.effectiveFeatures.queryOptions());
	if (!features[feature]) {
		throw redirect({ to: '/' });
	}
}
