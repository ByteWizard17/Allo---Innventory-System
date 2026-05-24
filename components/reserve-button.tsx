'use client'

import { useState } from 'react'

interface ReserveButtonProps {
  productId: string
  disabled?: boolean
  onSuccess?: () => void
}

export function ReserveButton({
  productId,
  disabled = false,
  onSuccess
}: ReserveButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleReserve = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId })
      })

      if (response.ok) {
        onSuccess?.()
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleReserve}
      disabled={disabled || isLoading}
      className="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {isLoading ? 'Reserving...' : 'Reserve'}
    </button>
  )
}
