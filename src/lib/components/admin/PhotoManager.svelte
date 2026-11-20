<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { invalidate } from '$app/navigation';
	import Check from '@lucide/svelte/icons/check';
	import Star from '@lucide/svelte/icons/star';
	import ImageIcon from '@lucide/svelte/icons/image';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Download from '@lucide/svelte/icons/download';
	import X from '@lucide/svelte/icons/x';
	import Plus from '@lucide/svelte/icons/plus';
	import Tag from '@lucide/svelte/icons/tag';
	import Images from '@lucide/svelte/icons/images';
	import Layers from '@lucide/svelte/icons/layers';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Uploader from './Uploader.svelte';
	import { api, feedback } from './feedback.svelte.js';
	import { sortAdminPhotos } from '#lib/sort.js';
	import { formatBytes, formatDuration, mediaUrl } from '#lib/utils.js';
	import type { AdminPhoto, AdminSection, AdminSort, Tag as TagType } from '#lib/types.js';

	interface Props {
		albumId: number;
		photos: AdminPhoto[];
		tags: TagType[];
		sections: AdminSection[];
		coverPhotoId: number | null;
		backgroundPhotoId: number | null;
	}

	let { albumId, photos, tags, sections, coverPhotoId, backgroundPhotoId }: Props = $props();

	// Photos uploaded in this session appear immediately, before the page data refreshes.
	let uploaded = $state<AdminPhoto[]>([]);
	const all = $derived.by(() => {
		const known = new Set(photos.map((p) => p.id));
		return [...photos, ...uploaded.filter((p) => !known.has(p.id))];
	});

	let sort = $state<AdminSort>('oldest');
	let seed = $state(1);
	/** 'all', 'none' (photos without a section) or a section id. */
	let show = $state<'all' | 'none' | number>('all');
	const shown = $derived(
		show === 'all'
			? all
			: all.filter((photo) => (show === 'none' ? !photo.section : photo.section === show))
	);
	const sorted = $derived(sortAdminPhotos(shown, sort, seed));

	const PAGE = 120;
	let visible = $state(PAGE);

	const selected = new SvelteSet<number>();
	let anchor = $state<number | null>(null);
	let busy = $state(false);

	let tagChoice = $state<number | ''>('');
	let newTag = $state('');
	const tagNames = $derived(new Map(tags.map((t) => [t.id, t.name])));

	/* --------------------------------------------------------------- sections */

	const sectionNames = $derived(new Map(sections.map((s) => [s.id, s.title])));
	const sectionCounts = $derived.by(() => {
		const counts = new Map<number, number>();
		for (const photo of all) {
			if (photo.section) counts.set(photo.section, (counts.get(photo.section) ?? 0) + 1);
		}
		return counts;
	});
	const unsectioned = $derived(all.filter((photo) => !photo.section).length);
	/** Where new uploads go. */
	let uploadSection = $state<number | ''>('');
	/** Where “Move” sends the selection: a section id, 'none' or nothing chosen yet. */
	let moveChoice = $state<number | 'none' | ''>('');
	let newSection = $state('');
	let editing = $state<{ id: number; title: string; description: string } | null>(null);

	// Forget choices for sections that have been deleted.
	$effect(() => {
		const ids = new Set(sections.map((s) => s.id));
		if (typeof uploadSection === 'number' && !ids.has(uploadSection)) uploadSection = '';
		if (typeof moveChoice === 'number' && !ids.has(moveChoice)) moveChoice = '';
		if (typeof show === 'number' && !ids.has(show)) show = 'all';
	});

	async function createSection(event: SubmitEvent) {
		event.preventDefault();
		const title = newSection.trim();
		if (!title) return;
		busy = true;
		try {
			const result = await api<{ section: AdminSection }>(`/admin/api/albums/${albumId}`, {
				action: 'create-section',
				title
			});
			newSection = '';
			moveChoice = result.section.id;
			await refresh();
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		} finally {
			busy = false;
		}
	}

	async function saveSection(event: SubmitEvent) {
		event.preventDefault();
		if (!editing || !editing.title.trim()) return;
		const { id, title, description } = editing;
		await action('Section', { action: 'update-section', sectionId: id, title, description });
		editing = null;
	}

	async function moveSection(index: number, by: -1 | 1) {
		const ids = sections.map((s) => s.id);
		const target = index + by;
		if (target < 0 || target >= ids.length) return;
		[ids[index], ids[target]] = [ids[target], ids[index]];
		await action('Reorder', { action: 'reorder-sections', ids });
	}

	async function deleteSection(section: AdminSection) {
		const ok = await feedback.confirm({
			title: `Delete the section “${section.title}”?`,
			message:
				'Its photos stay in the album without a section, so they move to the top of the gallery.',
			confirmLabel: 'Delete section',
			danger: true
		});
		if (!ok) return;
		if (editing?.id === section.id) editing = null;
		await action(
			'Delete section',
			{ action: 'delete-section', sectionId: section.id },
			'Section deleted'
		);
	}

	async function moveSelected() {
		if (moveChoice === '' || !selected.size) return;
		const count = selected.size;
		const photosLabel = `${count} photo${count === 1 ? '' : 's'}`;
		await action(
			'Move',
			{
				action: 'assign-section',
				sectionId: moveChoice === 'none' ? null : moveChoice,
				ids: [...selected]
			},
			moveChoice === 'none'
				? `Took ${photosLabel} out of their section`
				: `Moved ${photosLabel} to “${sectionNames.get(moveChoice)}”`
		);
		// When filtering by section, the moved photos leave the view, so drop them from the selection.
		if (show !== 'all') clearSelection();
	}
	const tagCounts = $derived.by(() => {
		const counts = new Map<number, number>();
		for (const photo of all) for (const id of photo.tags) counts.set(id, (counts.get(id) ?? 0) + 1);
		return counts;
	});

	// Forget selected photos that no longer exist.
	$effect(() => {
		const ids = new Set(all.map((p) => p.id));
		for (const id of selected) if (!ids.has(id)) selected.delete(id);
	});

	async function refresh() {
		await invalidate('admin:album');
		uploaded = [];
	}

	function onpick(photo: AdminPhoto, index: number, event: MouseEvent) {
		if (event.shiftKey && anchor !== null) {
			const [from, to] = anchor < index ? [anchor, index] : [index, anchor];
			for (let i = from; i <= to; i++) selected.add(sorted[i].id);
			// Avoid the browser selecting text on shift-click.
			window.getSelection()?.removeAllRanges();
		} else if (selected.has(photo.id)) {
			selected.delete(photo.id);
		} else {
			selected.add(photo.id);
		}
		anchor = index;
	}

	function selectAll() {
		for (const photo of shown) selected.add(photo.id);
	}

	function clearSelection() {
		selected.clear();
		anchor = null;
	}

	async function action(label: string, body: Record<string, unknown>, success?: string) {
		busy = true;
		try {
			await api(`/admin/api/albums/${albumId}`, body);
			await refresh();
			if (success) feedback.toast(success);
		} catch (error) {
			feedback.toast(`${label}: ${(error as Error).message}`, 'error');
		} finally {
			busy = false;
		}
	}

	async function deleteSelected() {
		const ids = [...selected];
		const ok = await feedback.confirm({
			title: `Delete ${ids.length} photo${ids.length === 1 ? '' : 's'}?`,
			message: 'The original files and generated thumbnails will be permanently removed.',
			confirmLabel: 'Delete',
			danger: true
		});
		if (!ok) return;
		await action(
			'Delete',
			{ action: 'delete-photos', ids },
			`Deleted ${ids.length} photo${ids.length === 1 ? '' : 's'}`
		);
		clearSelection();
	}

	async function deleteOne(photo: AdminPhoto) {
		const ok = await feedback.confirm({
			title: 'Delete this photo?',
			message: `“${photo.name}” will be permanently removed.`,
			confirmLabel: 'Delete',
			danger: true
		});
		if (!ok) return;
		await action('Delete', { action: 'delete-photos', ids: [photo.id] }, 'Photo deleted');
	}

	async function applyTag(applied: boolean) {
		if (!tagChoice || !selected.size) return;
		const name = tagNames.get(tagChoice);
		await action(
			'Tagging',
			{ action: 'tag-photos', tagId: tagChoice, ids: [...selected], applied },
			applied
				? `Tagged ${selected.size} photo(s) “${name}”`
				: `Removed “${name}” from ${selected.size} photo(s)`
		);
	}

	async function createTag(event: SubmitEvent) {
		event.preventDefault();
		const name = newTag.trim();
		if (!name) return;
		busy = true;
		try {
			const result = await api<{ tag: TagType }>(`/admin/api/albums/${albumId}`, {
				action: 'create-tag',
				name
			});
			newTag = '';
			tagChoice = result.tag.id;
			await refresh();
		} catch (error) {
			feedback.toast((error as Error).message, 'error');
		} finally {
			busy = false;
		}
	}

	async function deleteTag(tag: TagType) {
		const ok = await feedback.confirm({
			title: `Delete the tag “${tag.name}”?`,
			message: 'It will be removed from every photo. The photos themselves are not affected.',
			confirmLabel: 'Delete tag',
			danger: true
		});
		if (!ok) return;
		if (tagChoice === tag.id) tagChoice = '';
		await action('Delete tag', { action: 'delete-tag', tagId: tag.id }, 'Tag deleted');
	}
</script>

<section class="block">
	{#if sections.length}
		<label class="upload-target">
			<span class="label">Upload into</span>
			<select class="select compact" bind:value={uploadSection}>
				<option value="">No section</option>
				{#each sections as section (section.id)}
					<option value={section.id}>{section.title}</option>
				{/each}
			</select>
		</label>
	{/if}
	<Uploader
		{albumId}
		sectionId={uploadSection === '' ? null : uploadSection}
		onuploaded={(photo) => (uploaded = [...uploaded, photo])}
		ondone={async ({ ok, failed }) => {
			await refresh();
			if (ok) feedback.toast(`Uploaded ${ok} photo${ok === 1 ? '' : 's'}`);
			if (failed) feedback.toast(`${failed} upload${failed === 1 ? '' : 's'} failed`, 'error');
		}}
	/>
</section>

<section class="block tags-block">
	<div class="tags-head">
		<h3><Tag size={15} strokeWidth={1.5} /> Tags</h3>
		<form class="new-tag" onsubmit={createTag}>
			<input
				class="input"
				placeholder="New tag, e.g. Ceremony"
				bind:value={newTag}
				maxlength="60"
				aria-label="New tag name"
			/>
			<button class="btn btn-sm btn-quiet" disabled={!newTag.trim() || busy}>
				<Plus size={13} /> Add
			</button>
		</form>
	</div>
	{#if tags.length}
		<ul class="tag-list">
			{#each tags as tag (tag.id)}
				<li>
					<span>{tag.name}</span>
					<span class="subtle">{tagCounts.get(tag.id) ?? 0}</span>
					<button onclick={() => deleteTag(tag)} aria-label="Delete tag {tag.name}" disabled={busy}>
						<X size={12} />
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="subtle small">
			Tags let visitors filter the gallery (for example “Ceremony”, “Portraits”). Create one, select
			photos, then apply it.
		</p>
	{/if}
</section>

<section class="block tags-block">
	<div class="tags-head">
		<h3><Layers size={15} strokeWidth={1.5} /> Sections</h3>
		<form class="new-tag" onsubmit={createSection}>
			<input
				class="input"
				placeholder="New section, e.g. Day 1 — Film"
				bind:value={newSection}
				maxlength="80"
				aria-label="New section title"
			/>
			<button class="btn btn-sm btn-quiet" disabled={!newSection.trim() || busy}>
				<Plus size={13} /> Add
			</button>
		</form>
	</div>
	{#if sections.length}
		<ol class="section-list">
			{#each sections as section, index (section.id)}
				<li>
					{#if editing?.id === section.id}
						<form class="section-edit" onsubmit={saveSection}>
							<input
								class="input"
								bind:value={editing.title}
								maxlength="80"
								aria-label="Section title"
								required
							/>
							<textarea
								class="input"
								bind:value={editing.description}
								maxlength="500"
								rows="2"
								placeholder="Optional line shown under the heading"
								aria-label="Section description"></textarea>
							<div class="section-edit-actions">
								<button class="btn btn-sm btn-solid" disabled={!editing.title.trim() || busy}>
									Save
								</button>
								<button type="button" class="btn btn-sm btn-quiet" onclick={() => (editing = null)}>
									Cancel
								</button>
							</div>
						</form>
					{:else}
						<div class="section-text">
							<span class="section-title">{section.title}</span>
							{#if section.description}<span class="subtle">{section.description}</span>{/if}
						</div>
						<span class="subtle count">{sectionCounts.get(section.id) ?? 0}</span>
						<div class="section-actions">
							<button
								onclick={() => moveSection(index, -1)}
								disabled={busy || index === 0}
								aria-label="Move {section.title} up"
								title="Move up"
							>
								<ArrowUp size={13} strokeWidth={1.5} />
							</button>
							<button
								onclick={() => moveSection(index, 1)}
								disabled={busy || index === sections.length - 1}
								aria-label="Move {section.title} down"
								title="Move down"
							>
								<ArrowDown size={13} strokeWidth={1.5} />
							</button>
							<button
								onclick={() =>
									(editing = {
										id: section.id,
										title: section.title,
										description: section.description
									})}
								disabled={busy}
								aria-label="Edit {section.title}"
								title="Edit"
							>
								<Pencil size={13} strokeWidth={1.5} />
							</button>
							<button
								class="danger"
								onclick={() => deleteSection(section)}
								disabled={busy}
								aria-label="Delete section {section.title}"
								title="Delete"
							>
								<X size={13} strokeWidth={1.5} />
							</button>
						</div>
					{/if}
				</li>
			{/each}
		</ol>
		{#if unsectioned}
			<p class="subtle small">
				{unsectioned} photo{unsectioned === 1 ? ' isn’t' : 's aren’t'} in a section yet. Visitors see
				{unsectioned === 1 ? 'it' : 'them'} first, above the sections.
			</p>
		{/if}
	{:else}
		<p class="subtle small">
			Sections split one gallery into parts, such as the days of a shoot. Visitors see each under
			its own heading and can download it on its own. Create one, select photos, then move them in.
		</p>
	{/if}
</section>

<div class="toolbar">
	<div class="selection">
		{#if selected.size}
			<strong>{selected.size}</strong> selected
			<button class="link" onclick={clearSelection}>Deselect</button>
		{:else}
			<span class="subtle">{shown.length} photo{shown.length === 1 ? '' : 's'}</span>
		{/if}
		<button class="link" onclick={selectAll} disabled={!shown.length}>Select all</button>
	</div>

	{#if selected.size}
		<div class="bulk">
			{#if sections.length}
				<select class="select compact" bind:value={moveChoice} aria-label="Section to move to">
					<option value="">Move to section…</option>
					{#each sections as section (section.id)}
						<option value={section.id}>{section.title}</option>
					{/each}
					<option value="none">No section</option>
				</select>
				<button
					class="btn btn-sm btn-quiet"
					disabled={moveChoice === '' || busy}
					onclick={moveSelected}
				>
					Move
				</button>
			{/if}
			{#if tags.length}
				<select class="select compact" bind:value={tagChoice} aria-label="Tag to apply">
					<option value="">Choose tag…</option>
					{#each tags as tag (tag.id)}<option value={tag.id}>{tag.name}</option>{/each}
				</select>
				<button
					class="btn btn-sm btn-quiet"
					disabled={!tagChoice || busy}
					onclick={() => applyTag(true)}
				>
					Apply
				</button>
				<button
					class="btn btn-sm btn-quiet"
					disabled={!tagChoice || busy}
					onclick={() => applyTag(false)}
				>
					Remove
				</button>
			{/if}
			<button class="btn btn-sm btn-danger" onclick={deleteSelected} disabled={busy}>
				<Trash2 size={13} /> Delete
			</button>
		</div>
	{/if}

	{#if sections.length}
		<label class="sort">
			<span class="label">Show</span>
			<select
				class="select compact"
				bind:value={show}
				onchange={() => {
					anchor = null;
					visible = PAGE;
				}}
			>
				<option value="all">All sections</option>
				{#each sections as section (section.id)}
					<option value={section.id}>{section.title}</option>
				{/each}
				<option value="none">No section</option>
			</select>
		</label>
	{/if}

	<label class="sort">
		<span class="label">Sort</span>
		<select
			class="select compact"
			bind:value={sort}
			onchange={() => {
				if (sort === 'random') seed = Math.floor(Math.random() * 1e9);
				anchor = null;
			}}
		>
			<option value="oldest">Oldest</option>
			<option value="newest">Newest</option>
			<option value="downloads">Most downloaded</option>
			<option value="random">Random</option>
			<option value="name">Filename A–Z</option>
		</select>
	</label>
</div>

{#if sorted.length}
	<p class="hint tip">Click to select · Shift-click to select a range</p>
	<ul class="grid">
		{#each sorted.slice(0, visible) as photo, index (photo.id)}
			{@const isSelected = selected.has(photo.id)}
			<li class="tile" class:selected={isSelected}>
				<button
					class="pick"
					onclick={(event) => onpick(photo, index, event)}
					aria-pressed={isSelected}
					aria-label="Select {photo.name}"
				>
					<img src={mediaUrl(photo, 'thumb')} alt="" loading="lazy" decoding="async" />
					<span class="check"
						>{#if isSelected}<Check size={13} strokeWidth={2.5} />{/if}</span
					>
					<span class="flags">
						{#if photo.id === coverPhotoId}<span class="flag"><Star size={10} /> Cover</span>{/if}
						{#if photo.id === backgroundPhotoId}<span class="flag">Background</span>{/if}
						{#if photo.kind === 'video'}<span class="flag"
								>Video {formatDuration(photo.duration)}</span
							>{/if}
					</span>
				</button>
				<div class="hover-actions">
					<button
						title="Set as cover"
						aria-label="Set {photo.name} as cover"
						onclick={() =>
							action('Cover', { action: 'set-cover', photoId: photo.id }, 'Cover updated')}
						disabled={busy || photo.id === coverPhotoId}
					>
						<Star size={14} strokeWidth={1.5} />
					</button>
					<button
						title={photo.id === backgroundPhotoId ? 'Clear background' : 'Set as background'}
						aria-label="Set {photo.name} as background"
						onclick={() =>
							action(
								'Background',
								{
									action: 'set-background',
									photoId: photo.id === backgroundPhotoId ? null : photo.id
								},
								photo.id === backgroundPhotoId ? 'Background cleared' : 'Background updated'
							)}
						disabled={busy}
					>
						<ImageIcon size={14} strokeWidth={1.5} />
					</button>
					<button
						class="danger"
						title="Delete photo"
						aria-label="Delete {photo.name}"
						onclick={() => deleteOne(photo)}
						disabled={busy}
					>
						<Trash2 size={14} strokeWidth={1.5} />
					</button>
				</div>
				<div class="meta">
					<span class="name" title={photo.name}>{photo.name}</span>
					<span class="details">
						{formatBytes(photo.size)}
						<span class="downloads" title="Downloads"><Download size={11} /> {photo.downloads}</span
						>
					</span>
					{#if sections.length && show === 'all'}
						<span class="tile-section" class:none={!photo.section}>
							{photo.section ? (sectionNames.get(photo.section) ?? '') : 'No section'}
						</span>
					{/if}
					{#if photo.tags.length}
						<span class="tile-tags">
							{#each photo.tags as tagId (tagId)}
								{#if tagNames.get(tagId)}<span>{tagNames.get(tagId)}</span>{/if}
							{/each}
						</span>
					{/if}
				</div>
			</li>
		{/each}
	</ul>
	{#if sorted.length > visible}
		<div class="more">
			<button class="btn btn-sm" onclick={() => (visible += PAGE)}>
				Show more ({sorted.length - visible} remaining)
			</button>
		</div>
	{/if}
{:else if all.length}
	<div class="empty">
		<Layers size={26} strokeWidth={1} />
		<p>
			{show === 'none'
				? 'Every photo is in a section.'
				: 'No photos in this section yet. Select some under All sections and move them in.'}
		</p>
		<button class="btn btn-sm" onclick={() => (show = 'all')}>Show All Sections</button>
	</div>
{:else}
	<div class="empty">
		<Images size={26} strokeWidth={1} />
		<p>No photos yet. Upload some above, or import them from the server folder in Maintenance.</p>
	</div>
{/if}

<style>
	.block {
		margin-bottom: 1.25rem;
	}

	.small {
		font-size: 0.82rem;
	}

	.tags-block {
		padding: 1.1rem 1.25rem;
		border: 1px solid var(--border);
		background: var(--bg-elevated);
	}

	.tags-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem 1rem;
		margin-bottom: 0.85rem;
	}

	.tags-head h3 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-family: var(--font-sans);
		font-size: 0.72rem;
		font-weight: 500;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}

	.new-tag {
		display: flex;
		gap: 0.5rem;
	}

	.new-tag .input {
		min-height: 36px;
		padding-block: 0.4rem;
		font-size: 0.86rem;
		width: 220px;
	}

	.tag-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.tag-list li {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.3rem 0.35rem 0.3rem 0.7rem;
		border: 1px solid var(--border-strong);
		font-size: 0.82rem;
	}

	.tag-list button {
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		border: 0;
		background: none;
		color: var(--text-subtle);
		cursor: pointer;
	}

	.tag-list button:hover {
		color: var(--danger);
	}

	.upload-target {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 0.75rem;
	}

	.section-list {
		display: grid;
		list-style: none;
		margin: 0 0 0.6rem;
		padding: 0;
		border-top: 1px solid var(--border);
	}

	.section-list li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 0.75rem;
		padding: 0.55rem 0;
		border-bottom: 1px solid var(--border);
		font-size: 0.86rem;
	}

	.section-text {
		display: grid;
		min-width: 0;
	}

	.section-text .subtle {
		font-size: 0.78rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.section-list .count {
		font-variant-numeric: tabular-nums;
	}

	.section-actions {
		display: flex;
		gap: 2px;
	}

	.section-actions button {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border: 0;
		background: none;
		color: var(--text-subtle);
		cursor: pointer;
	}

	.section-actions button:hover:not(:disabled) {
		color: var(--text);
		background: var(--surface);
	}

	.section-actions button.danger:hover:not(:disabled) {
		color: var(--danger);
	}

	.section-actions button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.section-edit {
		grid-column: 1 / -1;
		display: grid;
		gap: 0.5rem;
	}

	.section-edit .input {
		font-size: 0.86rem;
	}

	.section-edit-actions {
		display: flex;
		gap: 0.5rem;
	}

	.tile-section {
		font-size: 0.7rem;
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tile-section.none {
		color: var(--text-subtle);
		font-style: italic;
	}

	.toolbar {
		position: sticky;
		top: 0;
		z-index: 20;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 1.25rem;
		padding: 0.75rem 0;
		background: var(--bg);
		border-bottom: 1px solid var(--border);
		font-size: 0.86rem;
	}

	@media (max-width: 959px) {
		.toolbar {
			top: 60px;
		}
	}

	.selection {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.selection .link {
		font-size: 0.64rem;
	}

	.bulk {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
	}

	.select.compact {
		min-height: 36px;
		width: auto;
		padding-block: 0.3rem;
		font-size: 0.84rem;
	}

	.sort {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-left: auto;
	}

	.tip {
		margin: 0.85rem 0 0.75rem;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 0.85rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.tile {
		position: relative;
		min-width: 0;
	}

	.pick {
		position: relative;
		display: block;
		width: 100%;
		aspect-ratio: 1;
		padding: 0;
		border: 0;
		background: var(--placeholder);
		overflow: hidden;
		cursor: pointer;
		user-select: none;
	}

	.pick img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 0.3s var(--ease);
	}

	.pick::after {
		content: '';
		position: absolute;
		inset: 0;
		border: 3px solid transparent;
		pointer-events: none;
		transition: border-color 0.15s;
	}

	.selected .pick::after {
		border-color: var(--text);
	}

	.selected .pick img {
		transform: scale(0.94);
	}

	.check {
		position: absolute;
		top: 8px;
		left: 8px;
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		border: 1.5px solid #fff;
		background: rgba(0, 0, 0, 0.2);
		color: var(--bg);
		opacity: 0;
		transition: opacity 0.15s;
	}

	.pick:hover .check,
	.selected .check {
		opacity: 1;
	}

	.selected .check {
		background: var(--text);
		border-color: var(--text);
	}

	.flags {
		position: absolute;
		left: 8px;
		bottom: 8px;
		display: flex;
		gap: 0.3rem;
	}

	.flag {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.15rem 0.45rem;
		background: rgba(20, 18, 15, 0.72);
		color: #fff;
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.hover-actions {
		position: absolute;
		top: 8px;
		right: 8px;
		display: flex;
		gap: 2px;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.tile:hover .hover-actions,
	.tile:focus-within .hover-actions {
		opacity: 1;
	}

	@media (hover: none) {
		.hover-actions {
			opacity: 1;
		}
	}

	.hover-actions button {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border: 0;
		background: rgba(251, 248, 242, 0.92);
		color: #26231f;
		cursor: pointer;
	}

	.hover-actions button:hover:not(:disabled) {
		background: #fff;
	}

	.hover-actions button.danger:hover:not(:disabled) {
		background: var(--danger);
		color: #fff;
	}

	.hover-actions button:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.meta {
		display: grid;
		gap: 0.15rem;
		padding-top: 0.45rem;
		font-size: 0.76rem;
	}

	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.details {
		display: flex;
		justify-content: space-between;
		color: var(--text-subtle);
	}

	.downloads {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
	}

	.tile-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin-top: 0.15rem;
	}

	.tile-tags span {
		padding: 0.05rem 0.4rem;
		background: var(--surface);
		font-size: 0.66rem;
		color: var(--text-muted);
	}

	.more {
		display: flex;
		justify-content: center;
		margin-top: 2rem;
	}

	.empty {
		display: grid;
		justify-items: center;
		gap: 0.75rem;
		padding: 3.5rem 1rem;
		border: 1px solid var(--border);
		color: var(--text-muted);
		text-align: center;
		margin-top: 1rem;
	}
</style>
