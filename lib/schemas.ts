import { z } from 'zod'

export const CreateReservationSchema = z.object({
  productId: z.string().cuid(),
  warehouseId: z.string().cuid(),
  quantity: z.number().int().positive(),
  idempotencyKey: z.string().optional(),
})

export const ConfirmReservationSchema = z.object({
  idempotencyKey: z.string().optional(),
})

export const ReleaseReservationSchema = z.object({
  idempotencyKey: z.string().optional(),
})

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>
export type ConfirmReservationInput = z.infer<typeof ConfirmReservationSchema>
export type ReleaseReservationInput = z.infer<typeof ReleaseReservationSchema>
