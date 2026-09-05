import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

const storage = new AsyncLocalStorage<{ requestId: string }>();

export function getRequestId() {
  return storage.getStore()?.requestId;
}

export function newRequestId() {
  return randomUUID();
}

export function runWithRequestId<T>(requestId: string, fn: () => T | Promise<T>) {
  return storage.run({ requestId }, fn);
}
