import type { ArenaCatalogIndex } from '../catalog/types'
import type { ArenaRouteSet } from '../recommendation/types'
import type { ArenaSession } from '../session/types'

export type ArenaDecisionViewModel = {
  session: ArenaSession
  routes: ArenaRouteSet
  catalog: ArenaCatalogIndex
  comboLabel: string
  sourceLabel: string
}
