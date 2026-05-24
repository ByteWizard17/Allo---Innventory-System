'use client'

import { StockBadge } from './stock-badge'
import { AlertCircle, Loader2, PackageCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Warehouse {
  warehouseId: string
  warehouseName: string
  location?: string
  totalStock: number
  reserved: number
  available: number
}

interface ProductCardProps {
  id: string
  name: string
  price: number
  sku: string
  description?: string
  warehouses: Warehouse[]
  onReserved?: () => void
}

export function ProductCard({
  id,
  name,
  price,
  sku,
  description,
  warehouses,
  onReserved,
}: ProductCardProps) {
  const router = useRouter()
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(
    () => warehouses.find((warehouse) => warehouse.available > 0)?.warehouseId ?? ''
  )
  const [quantity, setQuantity] = useState(1)
  const [isReserving, setIsReserving] = useState(false)
  const [message, setMessage] = useState<{
    type: 'error' | 'success'
    text: string
  } | null>(null)

  const totalAvailable = warehouses.reduce((sum, w) => sum + w.available, 0)
  const selectedWarehouse = warehouses.find(
    (warehouse) => warehouse.warehouseId === selectedWarehouseId
  )
  const maxQuantity = selectedWarehouse?.available ?? 0

  const handleWarehouseChange = (warehouseId: string) => {
    const nextWarehouse = warehouses.find(
      (warehouse) => warehouse.warehouseId === warehouseId
    )

    setSelectedWarehouseId(warehouseId)
    setQuantity(Math.min(quantity, Math.max(nextWarehouse?.available ?? 1, 1)))
    setMessage(null)
  }

  const reserve = async () => {
    if (!selectedWarehouse || maxQuantity === 0) {
      setMessage({
        type: 'error',
        text: 'Select a warehouse with available stock before reserving.',
      })
      return
    }

    setIsReserving(true)
    setMessage(null)

    const idempotencyKey =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `reserve-${id}-${selectedWarehouse.warehouseId}-${Date.now()}`

    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          productId: id,
          warehouseId: selectedWarehouse.warehouseId,
          quantity,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 409) {
          setMessage({
            type: 'error',
            text: '409: Not enough stock is available anymore. The list has been refreshed.',
          })
          onReserved?.()
          return
        }

        setMessage({
          type: 'error',
          text: `${response.status}: ${data.error ?? 'Could not create reservation.'}`,
        })
        return
      }

      const checkoutSnapshot = {
        reservation: data.data,
        product: {
          id,
          name,
          price,
          sku,
          description,
        },
        warehouse: selectedWarehouse,
        quantity,
      }

      sessionStorage.setItem(
        `reservation:${data.data.id}`,
        JSON.stringify(checkoutSnapshot)
      )
      onReserved?.()
      router.push(`/checkout/${data.data.id}`)
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to create reservation.',
      })
    } finally {
      setIsReserving(false)
    }
  }

  return (
    <div className="app-card overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(15,23,42,0.12)]">
      <div className="border-b border-slate-100 bg-gradient-to-br from-white to-slate-50 p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-slate-950">{name}</h3>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              SKU {sku}
            </p>
          </div>
          <p className="shrink-0 rounded-lg bg-slate-950 px-3 py-2 text-lg font-bold text-white shadow-sm">
            ${price.toFixed(2)}
          </p>
        </div>

        {description && (
          <p className="text-sm leading-6 text-slate-600">{description}</p>
        )}
      </div>

      <div className="p-5">
        <div className="mb-4">
          <p className="mb-2 text-sm font-bold text-slate-800">
            Available by Warehouse:
          </p>
          <div className="space-y-2">
            {warehouses.map((warehouse) => (
              <div
                key={warehouse.warehouseId}
                className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-sm transition ${
                  selectedWarehouseId === warehouse.warehouseId
                    ? 'border-sky-300 bg-sky-50 shadow-sm'
                    : 'border-slate-200 bg-slate-50/80 hover:border-slate-300'
                }`}
              >
                <div>
                  <label className="flex cursor-pointer items-center gap-2 font-semibold text-slate-900">
                    <input
                      type="radio"
                      name={`warehouse-${id}`}
                      value={warehouse.warehouseId}
                      checked={selectedWarehouseId === warehouse.warehouseId}
                      disabled={warehouse.available === 0 || isReserving}
                      onChange={() => handleWarehouseChange(warehouse.warehouseId)}
                      className="h-4 w-4 accent-slate-950"
                    />
                    {warehouse.warehouseName}
                  </label>
                  {warehouse.location && (
                    <p className="ml-6 text-slate-500">{warehouse.location}</p>
                  )}
                </div>
                <div className="text-right">
                  <StockBadge stock={warehouse.available} />
                  <p className="mt-1 text-xs text-slate-500">
                    {warehouse.totalStock} total
                    {warehouse.reserved > 0 && `, ${warehouse.reserved} held`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-4 flex items-end gap-3">
          <label className="flex-1 text-sm font-bold text-slate-800">
            Quantity
            <input
              type="number"
              min="1"
              max={Math.max(maxQuantity, 1)}
              value={quantity}
              disabled={totalAvailable === 0 || isReserving}
              onChange={(event) => {
                const nextQuantity = Number.parseInt(event.target.value, 10) || 1
                setQuantity(Math.min(Math.max(nextQuantity, 1), Math.max(maxQuantity, 1)))
              }}
              className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-100 disabled:bg-slate-100"
            />
          </label>
          <button
            onClick={reserve}
            disabled={totalAvailable === 0 || !selectedWarehouseId || isReserving}
            className="primary-button h-11 min-w-32 text-sm"
          >
            {isReserving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <PackageCheck className="h-4 w-4" aria-hidden="true" />
            )}
            {totalAvailable > 0 ? 'Reserve' : 'Out of Stock'}
          </button>
        </div>

        {message && (
          <div
            className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
              message.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-green-200 bg-green-50 text-green-800'
            }`}
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{message.text}</p>
          </div>
        )}
      </div>
    </div>
  )
}
