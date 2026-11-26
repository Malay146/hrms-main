"use client";

import { useState } from "react";

/**
 * Run `onChange` during render when `value` changes (compared with Object.is).
 * This is React's recommended way to reset local state from props
 * ("adjusting state when a prop changes") instead of a setState-in-effect,
 * which renders twice and briefly shows stale values.
 */
export function useOnChange<T>(value: T, onChange: (next: T) => void) {
  const [previous, setPrevious] = useState(value);
  if (!Object.is(previous, value)) {
    setPrevious(value);
    onChange(value);
  }
}
