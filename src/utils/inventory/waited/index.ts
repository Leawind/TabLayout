/**
 * Options to configure the behavior of a Waited instance.
 */
export type WaitedOptions<T> = {
	/**
	 * Automatically resets the Waited instance after resolution or rejection.
	 * @default false
	 */
	autoReset: boolean;

	/**
	 * Whether to keep the resolved/rejected result after settling.
	 * @default true
	 */
	keepResult: boolean;

	/**
	 * Callback to invoke when resolved.
	 */
	onresolved?: (value: T) => void;

	/**
	 * Callback to invoke when rejected.
	 */
	onrejected?: (reason: unknown) => void;
};

/**
 * Represents the internal state of a Waited instance.
 */
export enum WaitedState {
	Init = 'init',
	Waiting = 'waiting',
	Resolved = 'resolved',
	Rejected = 'rejected',
}

/**
 * A Waited instance currently in the "waiting" state.
 */
export interface WaitingWaited<T> extends Waited<T> {
	isWaiting(): true;
	wait(): Promise<T>;
}

/**
 * A Waited instance that has been resolved.
 */
export interface ResolvedWaited<T> extends Waited<T> {
	isWaiting(): false;
	wait(): T;
}

/**
 * A Waited instance that has been rejected.
 */
export interface RejectedWaited<T> extends Waited<T> {
	isWaiting(): false;

	/**
	 * Throws the stored rejection reason.
	 */
	wait(): never;
}

/**
 * A controllable Promise wrapper with optional auto-reset and result retention.
 *
 * Can be manually resolved or rejected from outside, while exposing a `wait()` method
 * to retrieve the result or await its fulfillment.
 *
 * @template T - The type of the resolved value.
 */
export class Waited<T = void> {
	private options: WaitedOptions<T> = {
		autoReset: false,
		keepResult: true,
	};

	public constructor(options?: Partial<WaitedOptions<T>>) {
		this.options = Object.assign(this.options, options);

		if (this.options.autoReset) {
			this.reset();
		}
	}

	private state: WaitedState = WaitedState.Init;

	private promise?: Promise<T>;
	private resolveFn?: (value: T | PromiseLike<T>) => void;
	private rejectFn?: (reason?: unknown) => void;

	private result?: T;
	private reason?: unknown;

	/**
	 * Clears internal promise and result references.
	 */
	private clear(): void {
		this.resolveFn = undefined;
		this.rejectFn = undefined;
		this.promise = undefined;

		if (!this.options.keepResult) {
			this.result = undefined;
			this.reason = undefined;
		}
	}

	/**
	 * Resets the Waited instance, preparing it to wait for the next resolution or rejection.
	 *
	 * @returns The current instance (for chaining).
	 */
	public reset(): this {
		this.clear();
		this.promise = new Promise<T>((resolve, reject) => {
			this.resolveFn = resolve;
			this.rejectFn = reject;
		});
		this.state = WaitedState.Waiting;
		return this;
	}

	/**
	 * Checks whether the instance is currently waiting for resolution or rejection.
	 *
	 * @returns `true` if in "waiting" state, otherwise `false`.
	 */
	public isWaiting(): boolean {
		return this.state === WaitedState.Waiting;
	}

	/**
	 * Returns the current result or promise depending on the state.
	 *
	 * - If waiting, returns a pending promise.
	 * - If resolved, returns the resolved value.
	 * - If rejected, throws the rejection reason.
	 * - If never started, returns undefined.
	 */
	public wait(): Promise<T> | T | undefined {
		switch (this.state) {
			case WaitedState.Init:
				return undefined;
			case WaitedState.Waiting:
				return this.promise!;
			case WaitedState.Resolved:
				return this.result;
			case WaitedState.Rejected:
				throw this.reason;
		}
	}

	/**
	 * Checks whether the instance is settled (either resolved or rejected).
	 */
	public isSettled(): boolean {
		return this.state === WaitedState.Resolved || this.state === WaitedState.Rejected;
	}

	/**
	 * Checks whether the instance is resolved.
	 */
	public isResolved(): boolean {
		return this.state === WaitedState.Resolved;
	}

	/**
	 * Checks whether the instance is rejected.
	 */
	public isRejected(): boolean {
		return this.state === WaitedState.Rejected;
	}

	/**
	 * Resolves the current promise with the given value.
	 *
	 * @param value - The resolution value.
	 * @throws Error if called when not in the "waiting" state.
	 */
	public resolve(value: T): this {
		if (this.state !== WaitedState.Waiting) {
			throw new Error('Cannot resolve a non-waiting waited');
		}

		this.state = WaitedState.Resolved;
		this.result = value;

		this.resolveFn!(value);
		this.options.onresolved?.(value);

		this.clear();
		if (this.options.autoReset) {
			this.reset();
		}

		return this;
	}

	/**
	 * Rejects the current promise with the given reason.
	 *
	 * @param reason - The rejection reason (optional).
	 * @throws Error if called when not in the "waiting" state.
	 */
	public reject(reason?: unknown): this {
		if (this.state !== WaitedState.Waiting) {
			throw new Error('Cannot reject a non-waiting waited');
		}

		this.state = WaitedState.Rejected;
		this.reason = reason;

		this.rejectFn!(reason);
		this.options.onrejected?.(reason);

		this.clear();
		if (this.options.autoReset) {
			this.reset();
		}

		return this;
	}

	/**
	 * Creates a new Waited instance with the given options.
	 *
	 * If `autoReset: true` is set, the instance starts in a "waiting" state.
	 */
	public static create<T>(options?: Partial<WaitedOptions<T>>): Waited<T> {
		return new Waited(options);
	}
}
