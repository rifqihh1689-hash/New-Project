import { useToday } from '../../app/useToday'
import { PageTop } from '../../components/PageTop'
import { dayTypeLabel } from '../../domain/dayType'
import { headline } from '../../domain/headline'
import { formatDateLong } from '../../domain/time'
import { MoneyCard, TentirCard, WeekCard } from './BottomCards'
import { CloseDayCard } from './CloseDayCard'
import { useBeranda } from './data'
import { DayTypePicker } from './DayTypePicker'
import { GameStrip } from './GameStrip'
import { MutabaahCard } from './MutabaahCard'
import { Ritme } from './Ritme'
import { RoadCard } from './RoadCard'
import { StatCards } from './StatCards'
import { TodayList } from './TodayList'

export function BerandaPage() {
  const today = useToday()
  const data = useBeranda(today)
  if (!data) return <PageTop title="Beranda" />
  const type = data.snap.day?.type ?? null
  const isPasca = data.snap.result.effType === 'pasca'
  const context = [data.phase?.name, data.chapter ? `${data.chapter.name} minggu ke-${data.chapterWeek}` : null].filter(Boolean).join(' · ')
  return (
    <>
      <PageTop title="Beranda" />
      <section className="mt-4 mb-3.5 flex flex-wrap items-end gap-x-5 gap-y-3 md:mt-[26px] md:mb-[18px]">
        <div className="min-w-0">
          <div className="mb-1.5 text-[13px] text-muted">
            {formatDateLong(today)}
            {context && ` · ${context}`}
          </div>
          <h2 className="max-w-[640px] font-serif text-[22px] leading-tight font-normal md:text-[27px]">
            {headline({
              type,
              suggested: data.suggested,
              invalidPasca: data.snap.result.invalidPasca,
              hasTentir: data.tentir.today,
              workLabel: dayTypeLabel('stase', data.phase),
            })}
          </h2>
        </div>
        <DayTypePicker date={today} value={type} suggested={data.suggested} phase={data.phase} className="w-full lg:ml-auto lg:w-auto" />
      </section>

      <GameStrip data={data} />
      <StatCards data={data} isPasca={isPasca} />

      <section className="grid gap-3 lg:grid-cols-[1.55fr_1fr]">
        <div className="grid content-start gap-3">
          <Ritme data={data} />
          <TodayList data={data} />
        </div>
        <div className="grid content-start gap-3">
          <MutabaahCard data={data} />
          <CloseDayCard data={data} />
          {!isPasca && <RoadCard data={data} />}
        </div>
      </section>

      {!isPasca && (
        <section className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          <WeekCard data={data} />
          <TentirCard data={data} />
          <MoneyCard data={data} />
        </section>
      )}
    </>
  )
}
