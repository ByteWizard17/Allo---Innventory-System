export interface Product {
  id: string
  name: string
  description?: string
  price: number
  sku: string
  createdAt: Date
  updatedAt: Date
}

export interface Warehouse {
  id: string
  name: string
  location?: string
  createdAt: Date
  updatedAt: Date
}

export interface Inventory {
  id: string
  productId: string
  warehouseId: string
  quantity: number
  reserved: number
  createdAt: Date
  updatedAt: Date
  product?: Product
  warehouse?: Warehouse
}

export interface Reservation {
  id: string
  productId: string
  quantity: number
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED'
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
  product?: Product
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
