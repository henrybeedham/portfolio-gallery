import { error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/guard.js';
import {
	checkThemeFile,
	listThemes,
	saveCustomTheme,
	themeIdFromFilename
} from '#lib/server/themes.js';
import type { RequestHandler } from './$types';

const MAX_BYTES = 64 * 1024;

/** Uploads one or more theme files (form field “themes”). */
export const POST: RequestHandler = async ({ request, locals }) => {
	requireAdmin(locals);
	const form = await request.formData().catch(() => null);
	const files = (form?.getAll('themes') ?? []).filter((f): f is File => f instanceof File);
	if (!files.length) error(400, 'Choose one or more .json theme files.');
	if (files.length > 20) error(400, 'Upload at most 20 themes at a time.');

	const builtIn = new Set(
		listThemes()
			.filter((t) => t.builtIn)
			.map((t) => t.id)
	);
	const existing = new Set(
		listThemes()
			.filter((t) => !t.builtIn)
			.map((t) => t.id)
	);
	const saved: {
		id: string;
		file: string;
		replaced: 'built-in' | 'upload' | null;
		warnings: string[];
	}[] = [];
	const failed: { file: string; error: string }[] = [];

	for (const file of files) {
		if (!file.name.toLowerCase().endsWith('.json')) {
			failed.push({ file: file.name, error: 'Only .json files can be uploaded.' });
			continue;
		}
		if (file.size > MAX_BYTES) {
			failed.push({ file: file.name, error: 'The file is too big for a theme (64 KB at most).' });
			continue;
		}
		const id = themeIdFromFilename(file.name);
		const check = checkThemeFile(await file.text(), id);
		if (!check.ok) {
			failed.push({ file: file.name, error: check.error });
			continue;
		}
		saveCustomTheme(id, check.theme);
		saved.push({
			id,
			file: file.name,
			replaced: existing.has(id) ? 'upload' : builtIn.has(id) ? 'built-in' : null,
			warnings: check.warnings
		});
	}
	return Response.json({ saved, failed });
};
