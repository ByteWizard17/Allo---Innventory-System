import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Allo Inventory',
  description: 'Inventory Management System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <nav className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 shadow-sm backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-950">
                Allo Inventory
              </h1>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Reservation control plane
              </p>
            </div>
            <div className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700 sm:block">
              Live stock holds
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  )
}
