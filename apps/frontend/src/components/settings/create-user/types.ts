interface ModifyUserInfoProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onUserCreated: (email: string, password: string) => void;
}

export type { ModifyUserInfoProps };
