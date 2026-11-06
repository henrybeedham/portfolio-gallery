import { Marked } from 'marked';

const escapeHtml = (value: string) =>
	value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SAFE_URL = /^(https?:|mailto:|tel:|\/|#)/i;

const marked = new Marked({
	gfm: true,
	breaks: true,
	async: false,
	walkTokens(token) {
		if ((token.type === 'link' || token.type === 'image') && !SAFE_URL.test(token.href.trim())) {
			token.href = '#';
		}
	},
	renderer: {
		// Raw HTML is shown as text rather than rendered.
		html({ text }) {
			return escapeHtml(text);
		}
	}
});

/** Renders album descriptions. Raw HTML is escaped and only safe link protocols are allowed. */
export function renderMarkdown(source: string): string {
	if (!source.trim()) return '';
	const html = marked.parse(source) as string;
	return html.replace(
		/<a href="(https?:[^"]+)"/g,
		'<a href="$1" target="_blank" rel="noopener noreferrer"'
	);
}
