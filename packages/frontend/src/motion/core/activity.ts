/*
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export interface MotionActivityOptions {
	/** Resume shortly before the element enters the viewport. */
	rootMargin?: string;
	suspended?: boolean;
}

export type MotionActivitySubscriber = (active: boolean) => void;

export class MotionActivityController {
	private element: Element | null = null;
	private observer: IntersectionObserver | null = null;
	private intersecting = true;
	private documentVisible = typeof window === 'undefined' || window.document.visibilityState === 'visible';
	private suspended: boolean;
	private activeState: boolean;
	private readonly subscribers = new Set<MotionActivitySubscriber>();
	private readonly onVisibilityChange = () => {
		this.documentVisible = window.document.visibilityState === 'visible';
		this.update();
	};

	constructor(element: Element | null = null, private readonly options: MotionActivityOptions = {}) {
		this.suspended = options.suspended ?? false;
		this.activeState = this.documentVisible && !this.suspended;
		if (typeof window !== 'undefined') window.document.addEventListener('visibilitychange', this.onVisibilityChange);
		this.setElement(element);
	}

	public get active(): boolean {
		return this.activeState;
	}

	public setElement(element: Element | null): void {
		if (this.element === element) return;
		this.observer?.disconnect();
		this.observer = null;
		this.element = element;
		this.intersecting = true;

		if (element != null && typeof window !== 'undefined' && typeof window.IntersectionObserver !== 'undefined') {
			this.observer = new window.IntersectionObserver(records => {
				const record = records[records.length - 1];
				if (record == null) return;
				this.intersecting = record.isIntersecting;
				this.update();
			}, {
				root: null,
				rootMargin: this.options.rootMargin ?? '256px 0px',
				threshold: 0,
			});
			this.observer.observe(element);
		}

		this.update();
	}

	public setSuspended(suspended: boolean): void {
		if (this.suspended === suspended) return;
		this.suspended = suspended;
		this.update();
	}

	public subscribe(subscriber: MotionActivitySubscriber, immediate = false): () => void {
		this.subscribers.add(subscriber);
		if (immediate) subscriber(this.activeState);
		return () => this.subscribers.delete(subscriber);
	}

	public destroy(): void {
		this.observer?.disconnect();
		this.observer = null;
		this.element = null;
		this.subscribers.clear();
		if (typeof window !== 'undefined') window.document.removeEventListener('visibilitychange', this.onVisibilityChange);
	}

	private update(): void {
		const next = this.documentVisible && this.intersecting && !this.suspended;
		if (next === this.activeState) return;
		this.activeState = next;
		for (const subscriber of [...this.subscribers]) subscriber(next);
	}
}
