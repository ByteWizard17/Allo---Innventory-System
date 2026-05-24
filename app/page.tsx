'use client'

import { useCallback, useEffect, useState } from 'react'
import { ProductCard } from '@/components/product-card'
import { RefreshCw, ShieldCheck } from 'lucide-react'

interface Product {
  id: string
  name: string
  price: number
  sku: string
  description?: string
  warehouses: {
    warehouseId: string
    warehouseName: string
    location?: string
    totalStock: number
    reserved: number
    available: number
  }[]
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProducts = useCallback(async (showFullLoader = false) => {
    try {
      if (showFullLoader) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      const response = await fetch('/api/products', { cache: 'no-store' })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch products')
      }

      setProducts(data.data)
      setError(null)
    } catch (err) {
      console.error('Error fetching products:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      if (showFullLoader) {
        setLoading(false)
      } else {
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    fetchProducts(true)
  }, [fetchProducts])

  return (
    <div className="space-y-8">
      <div className="app-card overflow-hidden">
        <div className="flex flex-col gap-6 border-b border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 px-6 py-7 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-700">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Concurrency-safe checkout holds
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
            Allo Inventory Reservations
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            Reserve available units by warehouse, then confirm or cancel the hold
            from checkout. Stock counts refresh after reservation actions.
          </p>
        </div>

        <button
          onClick={() => fetchProducts(false)}
          disabled={refreshing || loading}
          className="secondary-button h-11 text-sm"
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          Refresh stock
        </button>
        </div>
        <div className="grid gap-3 px-6 py-4 text-sm text-slate-600 sm:grid-cols-3">
          <div>
            <span className="block font-bold text-slate-950">{products.length}</span>
            Products monitored
          </div>
          <div>
            <span className="block font-bold text-slate-950">
              {products.reduce((sum, product) => sum + product.warehouses.length, 0)}
            </span>
            Warehouse stock rows
          </div>
          <div>
            <span className="block font-bold text-slate-950">
              {products.reduce(
                (sum, product) =>
                  sum +
                  product.warehouses.reduce(
                    (warehouseSum, warehouse) => warehouseSum + warehouse.available,
                    0
                  ),
                0
              )}
            </span>
            Units available now
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
          <p className="mt-4 text-gray-600">Loading products...</p>
        </div>
      ) : products.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              {...product}
              onReserved={() => fetchProducts(false)}
            />
          ))}
        </div>
      ) : (
        <div className="app-card py-12 text-center">
          <p className="text-lg text-slate-600">No products available</p>
        </div>
      )}
    </div>
  )
}
