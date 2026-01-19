import { createContext, useContext } from 'react';
import type { AgentHelpers } from '@/hooks/use-agent';
import { useAgent, useSyncMessages } from '@/hooks/use-agent';

const AgentContext = createContext<AgentHelpers | null>(null);

export const useAgentContext = () => {
	const agent = useContext(AgentContext);
	if (!agent) {
		throw new Error('useAgentContext must be used within a AgentProvider');
	}
	return agent;
};

export interface Props {
	children: React.ReactNode;
}

export const AgentProvider = ({ children }: Props) => {
	const agent = useAgent();

	useSyncMessages({ agent });

	return <AgentContext.Provider value={agent}>{children}</AgentContext.Provider>;
};
