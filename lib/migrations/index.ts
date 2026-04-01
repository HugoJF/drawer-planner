import { nullTo1, type StateV0 } from './null-to-1'
import { oneTo2, type StateV1 } from './1-to-2'

type RawInput = { version?: unknown; [key: string]: unknown }
type MigratedState = { version: number; [key: string]: unknown }

export function migrate(raw: RawInput): MigratedState {
  let state: Record<string, unknown> = { ...raw }

  // If version is not a number, treat as unknown (pre-versioning)
  if (typeof state.version !== 'number') {
    state = { ...nullTo1(state as StateV0) }
  }

  if ((state.version as number) < 2) {
    state = { ...oneTo2(state as StateV1) }
  }

  return state as MigratedState
}
