interface StockBadgeProps {
  stock: number
}

export function StockBadge({ stock }: StockBadgeProps) {
  const getStatusColor = () => {
    if (stock === 0) return 'border-red-200 bg-red-50 text-red-700'
    if (stock < 5) return 'border-amber-200 bg-amber-50 text-amber-700'
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }

  const getStatusText = () => {
    if (stock === 0) return 'Out of Stock'
    if (stock < 5) return 'Low Stock'
    return 'In Stock'
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${getStatusColor()}`}>
      {getStatusText()} ({stock})
    </span>
  )
}
