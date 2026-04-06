import { nullTo1, type StateV0 } from './null-to-1'
import { oneTo2, type StateV1 } from './1-to-2'
import { twoTo3, type StateV2 } from './2-to-3'
import { threeTo4, type StateV3 } from './3-to-4'

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

  if ((state.version as number) < 3) {
    state = { ...twoTo3(state as StateV2) }
  }

  if ((state.version as number) < 4) {
    state = { ...threeTo4(state as StateV3) }
  }

  return state as MigratedState
}
