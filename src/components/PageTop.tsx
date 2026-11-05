import { CaptureBar } from '../features/capture/QuickCapture'

/** Judul halaman + Catat cepat (iPad/laptop). Di HP judul tampil di halaman, Catat cepat lewat tombol +. */
export function PageTop({ title }: { title: string }) {
  return (
    <div className="hidden items-center gap-3.5 md:flex">
      <h1 className="mr-auto text-[26px] font-semibold tracking-tight">{title}</h1>
      <CaptureBar />
    </div>
  )
}
