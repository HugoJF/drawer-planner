import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function indexById<T extends { id: string }>(arr: T[]): Map<string, T> {
  return new Map(arr.map(x => [x.id, x]))
}

export function toggleInSet<T>(set: Set<T>, item: T): Set<T> {
  const next = new Set(set)
  if (next.has(item)) {
    next.delete(item)
  } else {
    next.add(item)
  }
  return next
}
