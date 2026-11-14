import { ChevronDown, Inbox } from 'lucide-react'
import { useState } from 'react'
import { useMediaQuery } from '../../app/useMediaQuery'
import { useToday } from '../../app/useToday'
import { PageTop } from '../../components/PageTop'
import { MoneyCard, TentirCard, WeekCard } from './BottomCards'
import { CloseDayCard } from './CloseDayCard'
import { EnergyCard } from './EnergyCard'
import { useBeranda } from './data'
import { GameStrip } from './GameStrip'
import { Hero } from './Hero'
import { LevelUp } from './LevelUp'
import { MealsCard } from './MealsCard'
import { MiniCalendar } from './MiniCalendar'
import { MutabaahCard } from './MutabaahCard'
import { PrioritiesCard } from './PrioritiesCard'
import { Ritme } from './Ritme'
import { RoadCard } from './RoadCard'
import { StatCards } from './StatCards'
import { TodayList } from './TodayList'

const MORE_KEY = 'qawwam:beranda-lainnya'

export function BerandaPage() {
  const today = useToday()
  const data = useBeranda(today)
  const wide = useMediaQuery('(min-width: 768px)')
  const [more, setMoreState] = useState(() => localStorage.getItem(MORE_KEY) === '1')
  const setMore = (v: boolean) => {
    setMoreState(v)
    localStorage.setItem(MORE_KEY, v ? '1' : '0')
  }
  if (!data) return <PageTop title="Beranda" />
  const isPasca = data.snap.result.effType === 'pasca'
  return (
    <>
      <PageTop title="Beranda" />
      <Hero data={data} />

      {data.pendingProposals > 0 && (
        <a
          href="#/usulan"
          className="mb-3.5 flex items-center gap-2.5 rounded-[14px] border border-line bg-surface px-3.5 py-2.5 text-[13.5px] hover:bg-surface-2"
        >
          <Inbox size={16} className="text-tentir" aria-hidden="true" />
          <span className="flex-1">
            <b className="font-semibold">{data.pendingProposals} usulan dari Claude</b> menunggu persetujuan
          </span>
          <span className="text-faint">Tinjau →</span>
        </a>
      )}
      <GameStrip data={data} />
      {wide ? (
        <>
          <StatCards data={data} isPasca={isPasca} />
          <section className="grid gap-3 lg:grid-cols-[1.55fr_1fr]">
            <div className="stagger grid content-start gap-3">
              <Ritme data={data} />
              <TodayList data={data} />
            </div>
            <div className="stagger grid content-start gap-3">
              {!isPasca && <PrioritiesCard data={data} />}
              <EnergyCard data={data} />
              <MutabaahCard data={data} />
              <MiniCalendar today={today} />
              <MealsCard data={data} />
              <CloseDayCard data={data} />
              {!isPasca && <RoadCard data={data} />}
            </div>
          </section>
          {!isPasca && (
            <section className="stagger mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              <WeekCard data={data} />
              <TentirCard data={data} />
              <MoneyCard data={data} />
            </section>
          )}
        </>
      ) : (
        // HP = "Hari ini": yang dikerjakan sekarang dulu, ringkasan lain bisa dibuka.
        <div className="stagger grid gap-3">
          <TodayList data={data} />
          {/* Sisa jadwal hari ini (tentir, latihan, agenda, jam tidur) selalu terlihat di HP. */}
          <Ritme data={data} compact />
          <EnergyCard data={data} />
          <MutabaahCard data={data} />
          <CloseDayCard data={data} />
          <button
            type="button"
            aria-expanded={more}
            onClick={() => setMore(!more)}
            className="flex items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-line py-2.5 text-[13px] text-muted"
          >
            {more ? 'Sembunyikan ringkasan lain' : 'Ringkasan lain: tidur, prioritas, makan, uang…'}
            <ChevronDown size={15} className={`transition-transform duration-300 ${more ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {more && (
            <>
              <StatCards data={data} isPasca={isPasca} />
              {!isPasca && <PrioritiesCard data={data} />}
              <MealsCard data={data} />
              {!isPasca && <RoadCard data={data} />}
              {!isPasca && <WeekCard data={data} />}
              {!isPasca && <TentirCard data={data} />}
              {!isPasca && <MoneyCard data={data} />}
            </>
          )}
        </div>
      )}
      <LevelUp level={data.level.level} tokens={data.tokens} />
    </>
  )
}
