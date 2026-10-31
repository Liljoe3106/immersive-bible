import { useEffect, useState } from 'react'
import { useAppStore } from '../lib/store'

const PHONE_MQ = '(max-width: 640px)'

export function useIsPhone() {
  const [phone, setPhone] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(PHONE_MQ).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(PHONE_MQ)
    const sync = () => setPhone(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return phone
}

/** Phones read in Scroll until the reader picks a view; desktops open as a Book. */
export function useLayoutMode(): ['scroll' | 'book', (m: 'scroll' | 'book') => void] {
  const phone = useIsPhone()
  const layoutMode = useAppStore((s) => s.layoutMode)
  const chosen = useAppStore((s) => s.layoutChosen)
  const choose = useAppStore((s) => s.chooseLayoutMode)
  const effective = chosen ? layoutMode : phone ? 'scroll' : 'book'
  return [effective, choose]
}
