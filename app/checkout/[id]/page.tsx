'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Package,
  RotateCcw,
  XCircle,
} from 'lucide-react'
import { ReservationCountdown } from '@/components/reservation-countdown'

interface CheckoutSnapshot {
  reservation: {
    id: string
    productId: string
    quantity: number
    status: string
    expiresAt: string
  }
  product: {
    id: string
    name: string
    price: number
    sku: string
    description?: string
  }
  warehouse: {
    warehouseId: string
    warehouseName: string
    location?: string
    totalStock: number
    reserved: number
    available: number
  }
  quantity: number
}

type CheckoutState = 'pending' | 'confirmed' | 'released' | 'expired'

function makeIdempotencyKey(prefix: string, id: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${id}-${crypto.randomUUID()}`
  }

  return `${prefix}-${id}-${Date.now()}`
}

function userFacingError(status: number, fallback?: string) {
  if (status === 409) {
    return '409: Not enough stock is available. Please return to products and try a different warehouse or quantity.'
  }

  if (status === 410) {
    return '410: This reservation has expired. The held units are being released for other shoppers.'
  }

  if (status === 404) {
    return '404: Reservation not found.'
  }

  return `${status}: ${fallback ?? 'The checkout action could not be completed.'}`
}

export default function CheckoutPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const reservationId = params.id
  const confirmKeyRef = useRef(makeIdempotencyKey('confirm', reservationId))
  const releaseKeyRef = useRef(makeIdempotencyKey('release', reservationId))

  const [snapshot, setSnapshot] = useState<CheckoutSnapshot | null>(null)
  const [state, setState] = useState<CheckoutState>('pending')
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState<'confirm' | 'release' | null>(null)
  const [notice, setNotice] = useState<{
    type: 'success' | 'error' | 'warning'
    text: string
  } | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem(`reservation:${reservationId}`)

    if (stored) {
      const parsed = JSON.parse(stored) as CheckoutSnapshot
      setSnapshot(parsed)

      if (new Date(parsed.reservation.expiresAt).getTime() <= Date.now()) {
        setState('expired')
        setNotice({
          type: 'warning',
          text: 'This reservation timer has already expired.',
        })
      }
    } else {
      setNotice({
        type: 'error',
        text: 'Reservation details are not available in this browser session. Start a new reservation from the product list.',
      })
    }

    setLoading(false)
  }, [reservationId])

  const refreshProductsAndReturn = useCallback(() => {
    router.push('/')
    router.refresh()
  }, [router])

  const confirmPurchase = async () => {
    if (!snapshot || state !== 'pending') return

    setAction('confirm')
    setNotice(null)

    try {
      const response = await fetch(`/api/reservations/${reservationId}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': confirmKeyRef.current,
        },
      })
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 410) {
          setState('expired')
        }

        setNotice({
          type: 'error',
          text: userFacingError(response.status, data.error),
        })
        return
      }

      setState('confirmed')
      setSnapshot({
        ...snapshot,
        reservation: {
          ...snapshot.reservation,
          status: data.data?.status ?? 'CONFIRMED',
        },
      })
      sessionStorage.removeItem(`reservation:${reservationId}`)
      setNotice({
        type: 'success',
        text: 'Purchase confirmed. Inventory has been updated.',
      })
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to confirm purchase.',
      })
    } finally {
      setAction(null)
    }
  }

  const releaseReservation = async () => {
    if (!snapshot || state !== 'pending') return

    setAction('release')
    setNotice(null)

    try {
      const response = await fetch(`/api/reservations/${reservationId}/release`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': releaseKeyRef.current,
        },
      })
      const data = await response.json()

      if (!response.ok) {
        setNotice({
          type: 'error',
          text: userFacingError(response.status, data.error),
        })
        return
      }

      setState('released')
      setSnapshot({
        ...snapshot,
        reservation: {
          ...snapshot.reservation,
          status: data.data?.status ?? 'RELEASED',
        },
      })
      sessionStorage.removeItem(`reservation:${reservationId}`)
      setNotice({
        type: 'success',
        text: 'Reservation cancelled. The held units are available again.',
      })
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to cancel reservation.',
      })
    } finally {
      setAction(null)
    }
  }

  const markExpired = useCallback(() => {
    setState('expired')
    setNotice({
      type: 'warning',
      text: '410: Reservation expired. Return to products to create a fresh hold.',
    })
  }, [])

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-700" />
        <p className="mt-4 text-slate-600">Loading reservation...</p>
      </div>
    )
  }

  if (!snapshot) {
    return (
      <div className="mx-auto max-w-3xl py-12">
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm">
          {notice?.text}
        </div>
        <Link
          href="/"
          className="primary-button mt-6 h-11 text-sm"
        >
          Back to products
        </Link>
      </div>
    )
  }

  const total = snapshot.product.price * snapshot.reservation.quantity
  const isFinal = state === 'confirmed' || state === 'released'
  const statusLabel =
    state === 'released' ? 'RELEASED' : state === 'expired' ? 'EXPIRED' : snapshot.reservation.status

  return (
    <div className="mx-auto max-w-4xl py-8">
      <button
        onClick={refreshProductsAndReturn}
        className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-slate-700 transition hover:text-slate-950"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Back to refreshed products
      </button>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="app-card overflow-hidden">
          <div className="border-b border-slate-200 bg-gradient-to-br from-white via-slate-50 to-emerald-50 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Reservation {statusLabel}
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                {snapshot.product.name}
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-500">
                SKU {snapshot.product.sku}
              </p>
            </div>

            <div className="max-w-full overflow-hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm">
              {reservationId}
            </div>
            </div>
          </div>

          <div className="p-6">
          {notice && (
            <div
              className={`mb-6 flex items-start gap-3 rounded-lg border p-4 text-sm shadow-sm ${
                notice.type === 'success'
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : notice.type === 'warning'
                    ? 'border-yellow-200 bg-yellow-50 text-yellow-900'
                    : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              {notice.type === 'success' ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              ) : (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              )}
              <p>{notice.text}</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="soft-panel p-4">
              <p className="text-sm font-bold text-slate-500">Warehouse</p>
              <p className="mt-2 font-bold text-slate-950">
                {snapshot.warehouse.warehouseName}
              </p>
              {snapshot.warehouse.location && (
                <p className="mt-1 text-sm text-slate-600">
                  {snapshot.warehouse.location}
                </p>
              )}
            </div>

            <div className="soft-panel p-4">
              <p className="text-sm font-bold text-slate-500">Reserved units</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">
                {snapshot.reservation.quantity}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
            <p className="text-sm font-bold text-amber-900">Reservation timer</p>
            <p className="mt-2 text-4xl font-black tracking-tight text-amber-950">
              {state === 'pending' ? (
                <ReservationCountdown
                  expiresAt={new Date(snapshot.reservation.expiresAt)}
                  onExpire={markExpired}
                />
              ) : (
                statusLabel
              )}
            </p>
            <p className="mt-2 text-sm font-medium text-amber-900">
              Expires at {new Date(snapshot.reservation.expiresAt).toLocaleString()}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={confirmPurchase}
              disabled={state !== 'pending' || action !== null}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              {action === 'confirm' ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              )}
              Confirm purchase
            </button>

            <button
              onClick={releaseReservation}
              disabled={state !== 'pending' || action !== null}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 font-bold text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            >
              {action === 'release' ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <XCircle className="h-5 w-5" aria-hidden="true" />
              )}
              Cancel
            </button>
          </div>

          {isFinal && (
            <button
              onClick={refreshProductsAndReturn}
              className="primary-button mt-4 h-11 text-sm"
            >
              View updated stock
            </button>
          )}
          </div>
        </section>

        <aside className="app-card h-fit p-6">
          <div className="mb-5 flex items-center gap-2">
            <div className="rounded-lg bg-slate-100 p-2">
              <Package className="h-5 w-5 text-slate-700" aria-hidden="true" />
            </div>
            <h2 className="font-bold text-slate-950">Order summary</h2>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-slate-600">Unit price</span>
              <span className="font-bold text-slate-950">
                ${snapshot.product.price.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-600">Quantity</span>
              <span className="font-bold text-slate-950">
                {snapshot.reservation.quantity}
              </span>
            </div>
            <div className="border-t border-slate-200 pt-3">
              <div className="flex justify-between gap-4 text-base">
                <span className="font-bold text-slate-950">Total</span>
                <span className="text-xl font-black text-slate-950">
                  ${total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            Reusing the same confirm or cancel request keeps the same
            Idempotency-Key during this checkout session, so retries do not repeat
            the action.
          </div>
        </aside>
      </div>
    </div>
  )
}
