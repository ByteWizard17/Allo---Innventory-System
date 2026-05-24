export const validations = {
  isValidEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  },

  isValidQuantity: (quantity: number): boolean => {
    return quantity > 0 && Number.isInteger(quantity)
  },

  isValidPrice: (price: number): boolean => {
    return price >= 0 && Number.isFinite(price)
  },

  isValidProductName: (name: string): boolean => {
    return name.length > 0 && name.length <= 255
  },
}
