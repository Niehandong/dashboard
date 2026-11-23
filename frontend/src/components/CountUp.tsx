import { useEffect, useRef, useState } from 'react'

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

// 数字滚动：首次从 0 滚到目标值；数据刷新后从旧值滚到新值
export default function CountUp({ value, format = String, duration = 1200 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(reduced() ? value : 0)
  const from = useRef(reduced() ? value : 0)

  useEffect(() => {
    if (reduced()) { setShown(value); return }
    const start = performance.now(), a = from.current
    let raf = 0
    const step = (t: number) => {
      const p = Math.min((t - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(a + (value - a) * eased)
      if (p < 1) raf = requestAnimationFrame(step)
      else from.current = value
    }
    raf = requestAnimationFrame(step)
    return () => { cancelAnimationFrame(raf); from.current = value }
  }, [value, duration])

  return <>{format(Math.round(shown))}</>
}
