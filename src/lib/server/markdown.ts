import { Marked } from 'marked';

const escapeHtml = (value: string) =>
	value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Relative paths and fragments are allowed, but not protocol-relative URLs ("//example.com").
const SAFE_URL = /^(https?:|mailto:|tel:|\/(?![/\\])|#)/i;

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

/** An album description as one line of plain text, for `<meta name="description">`. */
export function markdownSummary(source: string, max = 160): string {
	const text = renderMarkdown(source)
		.replace(/<[^>]*>/g, ' ')
		.replace(/&(?:#(\d+)|(amp|lt|gt|quot|#39));/g, (_, code, name) =>
			code
				? String.fromCodePoint(Number(code))
				: { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[name as 'amp']
		)
		.replace(/\s+/g, ' ')
		.trim();
	if (text.length <= max) return text;
	return `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}
