import { nullTo1, type StateV0 } from './null-to-1'

type RawInput = { version?: unknown; [key: string]: unknown }
type MigratedState = { version: number; [key: string]: unknown }

export function migrate(raw: RawInput): MigratedState {
  let state: Record<string, unknown> = { ...raw }

  // If version is not a number, treat as unknown (pre-versioning)
  if (typeof state.version !== 'number') {
    state = { ...nullTo1(state as StateV0) }
  }

  // Each future step checks state.version so the chain works regardless of starting point.
  // Example: a state at v1 that needs to reach v3 would run both conversions in sequence.
  // if ((state.version as number) < 2) state = oneTo2(state as StateV1)
  // if ((state.version as number) < 3) state = twoTo3(state as StateV2)

  return state as MigratedState
}
