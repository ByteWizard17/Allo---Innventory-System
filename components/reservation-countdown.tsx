'use client'

import { useEffect, useState } from 'react'

interface ReservationCountdownProps {
  expiresAt: Date
  onExpire?: () => void
}

function formatRemaining(expiresAt: Date) {
  const diff = expiresAt.getTime() - Date.now()

  if (diff <= 0) {
    return 'Expired'
  }

  const minutes = Math.floor(diff / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}

export function ReservationCountdown({
  expiresAt,
  onExpire
}: ReservationCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>(() =>
    formatRemaining(expiresAt)
  )

  useEffect(() => {
    let didExpire = false

    const timer = setInterval(() => {
      const nextRemaining = formatRemaining(expiresAt)
      setTimeRemaining(nextRemaining)

      if (nextRemaining === 'Expired' && !didExpire) {
        didExpire = true
        onExpire?.()
        clearInterval(timer)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [expiresAt, onExpire])

  return (
    <span className={`font-semibold ${
      timeRemaining === 'Expired' ? 'text-red-600' : 'text-orange-600'
    }`}>
      {timeRemaining || 'Loading...'}
    </span>
  )
}
