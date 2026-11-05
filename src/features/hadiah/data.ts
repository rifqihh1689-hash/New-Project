import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { loadLevel } from '../../db/progress'
import { loadClaims, loadRewards } from '../../db/rewards'
import { bridgeStatus, tokensLeft } from '../../domain/rewards'
import type { ISODate } from '../../types'

export async function loadHadiah(today: ISODate) {
  const [level, rewards, claims, savings] = await Promise.all([loadLevel(today), loadRewards(), loadClaims(), db.savings.toArray()])
  return {
    today,
    level,
    rewards,
    claims,
    tokens: tokensLeft(level.level, claims.length),
    bridge: bridgeStatus(savings),
  }
}

export type HadiahData = Awaited<ReturnType<typeof loadHadiah>>

export const useHadiah = (today: ISODate) => useLiveQuery(() => loadHadiah(today), [today])
