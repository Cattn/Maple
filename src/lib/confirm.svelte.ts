export type ConfirmOptions = {
	headline: string;
	message: string;
	confirmLabel?: string;
};

type ConfirmRequest = ConfirmOptions & { resolve: (result: boolean) => void };

let request: ConfirmRequest | null = $state(null);

export const confirmState = {
	get current() {
		return request;
	}
};

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
	request?.resolve(false);
	return new Promise((resolve) => {
		request = { ...options, resolve };
	});
}

export function settleConfirm(result: boolean) {
	const pending = request;
	request = null;
	pending?.resolve(result);
}
