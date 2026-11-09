import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { loadStudyTarget } from '../../db/study'
import { countdown, recentWeeklyAverage, stalestSystem, systemStats, weakestSystem, weekProgress } from '../../domain/study'
import type { ISODate } from '../../types'

export async function loadBelajar(today: ISODate) {
  const [logs, target] = await Promise.all([db.studyLogs.toArray(), loadStudyTarget()])
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  const stats = systemStats(logs)
  const answered = logs.reduce((a, l) => a + l.total, 0)
  const correct = logs.reduce((a, l) => a + l.correct, 0)
  return {
    today,
    logs: sorted,
    target,
    stats,
    answered,
    accuracy: answered ? correct / answered : null,
    week: weekProgress(logs, today, target.weeklyQuestions),
    average: recentWeeklyAverage(logs, today),
    weakest: weakestSystem(stats),
    stalest: stalestSystem(stats),
    countdown: countdown(target.examDate, today),
  }
}

export type BelajarData = Awaited<ReturnType<typeof loadBelajar>>

export const useBelajar = (today: ISODate) => useLiveQuery(() => loadBelajar(today), [today])
