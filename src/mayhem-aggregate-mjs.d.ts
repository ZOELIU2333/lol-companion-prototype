// Ambient declaration for the JS mirror aggregator used by the build script.
// snapshot.ts holds the canonical typed implementation; this lets the parity test
// import the .mjs mirror under strict TypeScript without enabling allowJs.
declare module '*/scripts/mayhem/aggregate.mjs' {
  import type { AggregateInput, MayhemSnapshot } from './features/mayhem/snapshot'

  export function aggregateMayhemRecords(input: AggregateInput): MayhemSnapshot
}
