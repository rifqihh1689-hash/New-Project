import { useLiveQuery } from 'dexie-react-hooks'
import { resolveRules } from '../domain/rules'
import type { Chapter, DayType, Habit, MutabaahItem, Phase, Profile, RitmeSlot, Role, XpRules } from '../types'
import { db } from './db'
import {
  DEFAULT_HABITS,
  DEFAULT_MUTABAAH,
  DEFAULT_PHASES,
  DEFAULT_PROFILE,
  DEFAULT_RITME,
  DEFAULT_ROLES,
  mergeWithDefaults,
} from './defaults'

// ---------- Baca (bawaan + perubahan tersimpan) ----------

export async function loadRoles(): Promise<Role[]> {
  return mergeWithDefaults(DEFAULT_ROLES, await db.lifeRoles.toArray())
}

export async function loadPhases(): Promise<Phase[]> {
  return mergeWithDefaults(DEFAULT_PHASES, await db.phases.toArray())
}

export async function loadMutabaah(): Promise<MutabaahItem[]> {
  return mergeWithDefaults(DEFAULT_MUTABAAH, await db.mutabaah.toArray())
}

export async function loadHabits(): Promise<Habit[]> {
  return mergeWithDefaults(DEFAULT_HABITS, await db.habits.toArray())
}

export async function loadProfile(): Promise<Profile> {
  const stored = await db.profile.get(DEFAULT_PROFILE.id)
  return { ...DEFAULT_PROFILE, ...stored, ritme: { ...DEFAULT_RITME, ...stored?.ritme } }
}

export function rulesOf(profile: Pick<Profile, 'rules'>): XpRules {
  return resolveRules(profile.rules)
}

export const useRoles = () => useLiveQuery(loadRoles, [])
export const usePhases = () => useLiveQuery(loadPhases, [])
export const useMutabaahItems = () => useLiveQuery(loadMutabaah, [])
export const useProfile = () => useLiveQuery(loadProfile, [])

/** Peta ID → peran. Peran yang tidak dikenal tampil abu-abu, tidak pernah membuat app error. */
export function roleLookup(roles: Role[] | undefined): (id: string | null | undefined) => Role {
  const map = new Map((roles ?? DEFAULT_ROLES).map((r) => [r.id, r]))
  return (id) =>
    (id && map.get(id)) || {
      id: id ?? '',
      name: 'Tanpa peran',
      color: '#8b9096',
      order: 99,
      recovery: false,
      archived: false,
      createdAt: 0,
      updatedAt: 0,
    }
}

/** Fase yang sedang berjalan: fase aktif terakhir yang sudah mulai dan belum selesai. */
export { currentPhase } from '../domain/phase'

// ---------- Tulis ----------

/**
 * Menyimpan perubahan bawaan/struktur. Peran, fase, dan mutaba'ah tidak pernah dihapus,
 * hanya diarsipkan, supaya riwayat lama tetap punya nama & warna yang benar.
 */
export async function saveRole(role: Role): Promise<void> {
  await db.lifeRoles.put({ ...role, updatedAt: Date.now() })
}

export async function savePhase(phase: Phase): Promise<void> {
  await db.phases.put({ ...phase, updatedAt: Date.now() })
}

export async function saveMutabaahItem(item: MutabaahItem): Promise<void> {
  await db.mutabaah.put({ ...item, updatedAt: Date.now() })
}

export async function saveHabit(habit: Habit): Promise<void> {
  await db.habits.put({ ...habit, updatedAt: Date.now() })
}

export async function updateProfile(changes: Partial<Omit<Profile, 'id'>>): Promise<void> {
  await db.transaction('rw', db.profile, async () => {
    const current = (await db.profile.get(DEFAULT_PROFILE.id)) ?? DEFAULT_PROFILE
    await db.profile.put({ ...current, ...changes, id: DEFAULT_PROFILE.id, updatedAt: Date.now() })
  })
}

// ---------- Jadwal: stase & ritme ----------

export async function saveChapter(chapter: Chapter): Promise<void> {
  await db.chapters.put({ ...chapter, updatedAt: Date.now() })
}

export async function deleteChapter(id: string): Promise<Chapter | undefined> {
  const chapter = await db.chapters.get(id)
  await db.chapters.delete(id)
  return chapter
}

export const useChapters = () => useLiveQuery(() => db.chapters.orderBy('start').toArray(), [])

/** Menyimpan ritme satu tipe hari; `null` = kembali ke bawaan. Hanya tipe yang diubah yang disimpan. */
export async function saveRitme(type: DayType, slots: RitmeSlot[] | null): Promise<void> {
  await db.transaction('rw', db.profile, async () => {
    const current = (await db.profile.get(DEFAULT_PROFILE.id)) ?? DEFAULT_PROFILE
    const ritme = { ...current.ritme }
    if (slots) ritme[type] = slots
    else delete ritme[type]
    await db.profile.put({ ...current, ritme, id: DEFAULT_PROFILE.id, updatedAt: Date.now() })
  })
}

/** Ubah sebagian aturan XP (disimpan sebagai perubahan di atas aturan bawaan). */
export async function updateRules(changes: Partial<XpRules>): Promise<void> {
  const current = (await db.profile.get(DEFAULT_PROFILE.id))?.rules
  await updateProfile({ rules: { ...current, ...changes } })
}
