export function Brand({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 font-serif ${className}`}>
      <span
        className="size-[22px] rounded-full"
        style={{ background: 'conic-gradient(#5b8def, #9b7bea, #e8925b, #4cb782, #3bb5c4, #d4ad45, #5b8def)' }}
        aria-hidden="true"
      />
      Qawwam
    </div>
  )
}
