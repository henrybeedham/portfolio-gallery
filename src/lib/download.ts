/**
 * Hands a download to the browser, which streams it straight to disk and shows its own progress.
 * Nothing is held in the page's memory, however large the file. With `body`, it's sent as a POST.
 */
export function nativeDownload(url: string, body?: Record<string, string>) {
	if (!body) {
		const anchor = document.createElement('a');
		anchor.href = url;
		// Keeps the visitor on this page if the server answers with an error.
		anchor.download = '';
		anchor.rel = 'noopener';
		document.body.append(anchor);
		anchor.click();
		anchor.remove();
		return;
	}
	const form = document.createElement('form');
	form.method = 'POST';
	form.action = url;
	form.style.display = 'none';
	for (const [name, value] of Object.entries(body)) {
		const input = document.createElement('input');
		input.type = 'hidden';
		input.name = name;
		input.value = value;
		form.append(input);
	}
	document.body.append(form);
	form.submit();
	form.remove();
}
