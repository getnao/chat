import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ToolCallDensity, UserPreferences } from '@nao/shared/types';
import { useEffectiveUserGroupFeatures } from '@/hooks/use-effective-user-group-features';
import { useSession } from '@/lib/auth-client';
import { trpc } from '@/main';

const PREFERENCES_STALE_TIME_MS = 5 * 60 * 1000;

export const useToolCallDensity = () => {
	const { data: session } = useSession();
	const { compactModeEnabled } = useEffectiveUserGroupFeatures();
	const queryClient = useQueryClient();
	const preferencesQueryKey = trpc.user.getPreferences.queryKey();

	const preferencesQuery = useQuery({
		...trpc.user.getPreferences.queryOptions(),
		enabled: !!session?.user,
		staleTime: PREFERENCES_STALE_TIME_MS,
	});

	const { mutate: updatePreferences } = useMutation(
		trpc.user.updatePreferences.mutationOptions({
			onMutate: async ({ toolCallDensity }) => {
				if (!toolCallDensity) {
					return;
				}

				await queryClient.cancelQueries({ queryKey: preferencesQueryKey });
				const previous = queryClient.getQueryData(preferencesQueryKey);
				queryClient.setQueryData(
					preferencesQueryKey,
					(prev: UserPreferences | undefined): UserPreferences => ({ ...prev, toolCallDensity }),
				);
				return { previous };
			},
			onError: (_err, _vars, context) => {
				if (context) {
					queryClient.setQueryData(preferencesQueryKey, context.previous);
				}
			},
			onSettled: () => {
				queryClient.invalidateQueries({ queryKey: preferencesQueryKey });
			},
		}),
	);

	const storedDensity: ToolCallDensity = preferencesQuery.data?.toolCallDensity ?? 'detailed';
	const density: ToolCallDensity = storedDensity === 'compact' && !compactModeEnabled ? 'detailed' : storedDensity;

	const setDensity = useCallback(
		(toolCallDensity: ToolCallDensity) => {
			if (toolCallDensity === 'compact' && !compactModeEnabled) {
				return;
			}
			updatePreferences({ toolCallDensity });
		},
		[compactModeEnabled, updatePreferences],
	);

	return [density, setDensity] as const;
};
