import crypto from 'node:crypto';
import type { JobStatus } from '#lib/types.js';

interface Job extends JobStatus {
	albumId: number;
	finishedAt: number | null;
}

const jobs = new Map<string, Job>();

function prune() {
	const cutoff = Date.now() - 60 * 60 * 1000;
	for (const [id, job] of jobs) if (job.finishedAt && job.finishedAt < cutoff) jobs.delete(id);
}

export function runningJob(albumId: number): JobStatus | null {
	for (const job of jobs.values()) {
		if (job.albumId === albumId && job.status === 'running') return publicJob(job);
	}
	return null;
}

function publicJob(job: Job): JobStatus {
	const { albumId: _albumId, finishedAt: _finishedAt, ...rest } = job;
	return { ...rest };
}

export function getJob(id: string): JobStatus | null {
	const job = jobs.get(id);
	return job ? publicJob(job) : null;
}

/**
 * Runs `items` through `worker` in the background, tracking progress so the admin UI can poll it.
 */
export function startJob<T>(options: {
	albumId: number;
	kind: string;
	label: string;
	items: T[];
	concurrency?: number;
	worker: (item: T) => Promise<void>;
	onFinish?: () => void;
}): JobStatus {
	prune();
	const job: Job = {
		id: crypto.randomUUID(),
		albumId: options.albumId,
		kind: options.kind,
		label: options.label,
		total: options.items.length,
		done: 0,
		failed: 0,
		status: 'running',
		message: null,
		finishedAt: null
	};
	jobs.set(job.id, job);

	const queue = options.items.slice();
	const concurrency = Math.max(1, options.concurrency ?? 2);

	const next = async (): Promise<void> => {
		const item = queue.shift();
		if (item === undefined) return;
		try {
			await options.worker(item);
		} catch (error) {
			job.failed++;
			job.message = (error as Error).message;
			console.warn(`[gallery] ${options.kind} failed:`, (error as Error).message);
		}
		job.done++;
		return next();
	};

	void Promise.all(Array.from({ length: concurrency }, next))
		.then(() => {
			job.status = 'done';
		})
		.catch((error) => {
			job.status = 'error';
			job.message = (error as Error).message;
		})
		.finally(() => {
			job.finishedAt = Date.now();
			options.onFinish?.();
		});

	return publicJob(job);
}
