type ToastKind = 'success' | 'error' | 'info';

interface Toast {
	id: number;
	message: string;
	kind: ToastKind;
}

interface ConfirmRequest {
	title: string;
	message: string;
	confirmLabel: string;
	danger: boolean;
	resolve: (value: boolean) => void;
}

let nextId = 1;

class Feedback {
	toasts = $state<Toast[]>([]);
	confirmation = $state<ConfirmRequest | null>(null);

	toast(message: string, kind: ToastKind = 'success') {
		const id = nextId++;
		this.toasts.push({ id, message, kind });
		setTimeout(() => this.dismiss(id), kind === 'error' ? 6000 : 3500);
	}

	dismiss(id: number) {
		this.toasts = this.toasts.filter((toast) => toast.id !== id);
	}

	confirm(options: {
		title: string;
		message: string;
		confirmLabel?: string;
		danger?: boolean;
	}): Promise<boolean> {
		this.confirmation?.resolve(false);
		return new Promise((resolve) => {
			this.confirmation = {
				title: options.title,
				message: options.message,
				confirmLabel: options.confirmLabel ?? 'Confirm',
				danger: options.danger ?? false,
				resolve: (value) => {
					this.confirmation = null;
					resolve(value);
				}
			};
		});
	}
}

/** Client-side toasts and confirmation dialogs for the admin area. */
export const feedback = new Feedback();

/** POSTs JSON to an admin endpoint and returns the parsed response, throwing a readable error. */
export async function api<T = Record<string, unknown>>(
	url: string,
	body?: unknown,
	method = 'POST'
): Promise<T> {
	const response = await fetch(url, {
		method,
		headers: body ? { 'content-type': 'application/json' } : undefined,
		body: body ? JSON.stringify(body) : undefined
	});
	if (!response.ok) {
		let message = `Request failed (${response.status})`;
		try {
			const data = await response.json();
			if (data?.message) message = data.message;
		} catch {
			// not JSON
		}
		throw new Error(message);
	}
	return response.json();
}
