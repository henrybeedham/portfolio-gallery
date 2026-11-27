/**
 * The browser side of passkeys (`passkeys.ts`): turns the server's JSON options into what
 * `navigator.credentials` takes, and its answer back into JSON with base64url bytes.
 */

function toBytes(value: string): Uint8Array<ArrayBuffer> {
	const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
	const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
	return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function toBase64url(buffer: ArrayBuffer | null): string | null {
	if (!buffer) return null;
	let binary = '';
	for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function passkeysSupported() {
	return typeof window !== 'undefined' && 'PublicKeyCredential' in window && window.isSecureContext;
}

interface CreationJSON {
	challenge: string;
	user: { id: string; name: string; displayName: string };
	excludeCredentials: { type: 'public-key'; id: string; transports?: AuthenticatorTransport[] }[];
	[key: string]: unknown;
}

/** Asks the device to make a passkey, and returns what the server's `register` action needs. */
export async function createPasskey(options: CreationJSON) {
	const credential = (await navigator.credentials.create({
		publicKey: {
			...(options as unknown as PublicKeyCredentialCreationOptions),
			challenge: toBytes(options.challenge),
			user: { ...options.user, id: toBytes(options.user.id) },
			excludeCredentials: options.excludeCredentials.map((item) => ({
				...item,
				id: toBytes(item.id)
			}))
		}
	})) as PublicKeyCredential | null;
	if (!credential) throw new Error('No passkey was made.');
	const response = credential.response as AuthenticatorAttestationResponse;
	if (typeof response.getPublicKey !== 'function') {
		throw new Error('This browser is too old to add passkeys. Please update it and try again.');
	}
	return {
		id: toBase64url(credential.rawId),
		clientDataJSON: toBase64url(response.clientDataJSON),
		authenticatorData: toBase64url(response.getAuthenticatorData()),
		publicKey: toBase64url(response.getPublicKey()),
		publicKeyAlgorithm: response.getPublicKeyAlgorithm(),
		transports: response.getTransports?.() ?? []
	};
}

interface RequestJSON {
	challenge: string;
	[key: string]: unknown;
}

/** Asks the device to sign in with a passkey, and returns what the server's `verify` needs. */
export async function getPasskey(options: RequestJSON) {
	const credential = (await navigator.credentials.get({
		publicKey: {
			...(options as unknown as PublicKeyCredentialRequestOptions),
			challenge: toBytes(options.challenge)
		}
	})) as PublicKeyCredential | null;
	if (!credential) throw new Error('No passkey was chosen.');
	const response = credential.response as AuthenticatorAssertionResponse;
	return {
		id: toBase64url(credential.rawId),
		clientDataJSON: toBase64url(response.clientDataJSON),
		authenticatorData: toBase64url(response.authenticatorData),
		signature: toBase64url(response.signature)
	};
}

/** A cancelled or timed-out prompt, which needs no error message. */
export function isCancelled(error: unknown) {
	return (
		error instanceof DOMException &&
		(error.name === 'NotAllowedError' || error.name === 'AbortError')
	);
}
