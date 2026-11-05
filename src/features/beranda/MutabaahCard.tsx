import { Check } from '../../components/Check'
import { setMutabaahDone } from '../../db/daily'
import type { BerandaData } from './data'

/** Mutaba'ah tanpa skor: tampilan netral abu-abu, hanya konsistensi 7 & 30 hari. */
export function MutabaahCard({ data }: { data: BerandaData }) {
  return (
    <div className="card">
      <h3 className="card-title">
        Mutaba'ah <span className="text-[13px] font-medium text-faint">tanpa skor</span>
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {data.mutabaah.map(({ item, done, week }) => (
          <label
            key={item.id}
            className={`flex cursor-pointer items-center gap-2.5 rounded-xl bg-surface-2 px-3 py-2.5 text-[13px] ${done ? 'text-text' : 'text-muted'}`}
          >
            <Check
              checked={done}
              onChange={() => void setMutabaahDone(item.id, data.today, !done)}
              label={item.name}
              tone="muted"
              size="sm"
            />
            <span className="flex-1">{item.name}</span>
            <span className="text-[11px] text-faint tabular-nums" title="Konsistensi 7 hari">
              {week}/7
            </span>
          </label>
        ))}
      </div>
      <p className="mt-2.5 text-xs text-faint">Tidak masuk XP, level, atau streak. Hanya catatan konsistensi 7 &amp; 30 hari.</p>
    </div>
  )
}
