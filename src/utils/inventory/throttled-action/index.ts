import { Waited, type WaitingWaited } from '../waited/index';

/**
 * ThrottledAction encapsulates a function that is throttled by a minimum interval.
 *
 * - If called too frequently, execution is deferred until the interval has passed.
 * - Ensures that the function does not execute more often than desired.
 */
export class ThrottledAction<T> {
	private waited = new Waited<T>({ autoReset: true }) as WaitingWaited<T>;
	private lastExecutedAt: number = 0;
	private timeoutId?: number;

	/**
	 * Creates a new ThrottledAction instance.
	 *
	 * @param actionFn - The function to be executed lazily.
	 * @param interval - The minimum interval (in milliseconds) between executions (default: 200ms).
	 */
	public constructor(
		private actionFn: () => T,
		private interval: number = 200,
	) {}

	/**
	 * Executes the action immediately and updates the last execution time.
	 *
	 * @returns The result of the executed action.
	 */
	public executeImmediately(): T {
		this.lastExecutedAt = Date.now();
		return this.actionFn();
	}

	/**
	 * Requests execution of the action function.
	 *
	 * - If enough time has passed since the last execution, the function runs immediately.
	 * - Otherwise, schedules it to run after the remaining interval.
	 * - Returns either the immediate result or a Promise that resolves when execution occurs.
	 *
	 * @returns The result of the action, either directly or via Promise.
	 *
	 * @example
	 * ```ts
	 * const ta = new ThrottledAction(() => console.log('Executed'));
	 * ta.urge(); // Executes immediately
	 * ta.urge(); // Schedules for later
	 * ta.urge(); // Subsequent calls are ignored until execution
	 * ```
	 */
	public urge(): T | Promise<T> {
		const now = Date.now();
		if (now - this.lastExecutedAt > this.interval) {
			if (this.timeoutId === undefined) {
				return this.executeImmediately();
			}
		} else if (this.timeoutId === undefined) {
			this.timeoutId = setTimeout(() => {
				this.timeoutId = undefined;
				this.waited.resolve(this.executeImmediately());
			}, this.lastExecutedAt + this.interval - now) as unknown as number;
		}
		return this.waited.wait();
	}

	/**
	 * Returns the time elapsed since the last execution.
	 *
	 * @param now - Optional timestamp to use as the current time (default: Date.now()).
	 * @returns Milliseconds since the last execution.
	 */
	public sinceLastExecute(now: number = Date.now()): number {
		return now - this.lastExecutedAt;
	}

	/**
	 * Updates the function to be executed.
	 *
	 * @param action - The new action function.
	 * @returns The current ThrottledAction instance (for chaining).
	 */
	public setAction(action: () => T): this {
		this.actionFn = action;
		return this;
	}

	/**
	 * Creates a ThrottledAction using a fixed interval.
	 *
	 * @param actionFn - The function to be executed.
	 * @param interval - The interval between executions in milliseconds.
	 * @returns A new ThrottledAction instance.
	 */
	public static byInterval<T>(
		actionFn: () => T,
		interval: number = 200,
	): ThrottledAction<T> {
		return new ThrottledAction(actionFn, interval);
	}

	/**
	 * Creates a ThrottledAction based on a desired frequency.
	 *
	 * @param actionFn - The function to be executed.
	 * @param frequency - The number of times the function is allowed to run per second.
	 * @returns A new ThrottledAction instance.
	 */
	public static byFrequency<T>(
		actionFn: () => T,
		frequency: number = 5,
	): ThrottledAction<T> {
		return new ThrottledAction(actionFn, 1000 / frequency);
	}
}
