import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => (value ? value : undefined);

export const variables = defineEnvVars({
	DATA_DIR: {
		description: 'Directory holding the database, originals and generated images.',
		schema: (value) => value || './data'
	},
	IMPORT_DIR: {
		description:
			'Server-side folder that images can be imported from. Defaults to DATA_DIR/import.',
		schema: optional
	},
	ADMIN_USERNAME: {
		description: 'Username for the single administrator account.',
		schema: (value) => value || 'admin'
	},
	ADMIN_PASSWORD: {
		description:
			'Password for the administrator account. If unset, one is generated and stored in DATA_DIR.',
		schema: optional
	},
	SESSION_SECRET: {
		description: 'Secret used to sign cookies. If unset, one is generated and stored in DATA_DIR.',
		schema: optional
	}
});
