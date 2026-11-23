type Callback = (...args: never[]) => unknown;
const unaryCallbacks = new WeakSet<Callback>();

/** Mark a built-in whose optional argument is unrelated to collection indices. */
export function unaryCollectionCallback<T extends Callback>(callback: T): T {
  unaryCallbacks.add(callback);
  return callback;
}

/** Whether a built-in should receive only the value when iterating one collection. */
export function isUnaryCollectionCallback(callback: unknown): boolean {
  return typeof callback === 'function' && unaryCallbacks.has(callback as Callback);
}
