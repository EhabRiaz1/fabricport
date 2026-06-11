import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Currency = 'PKR' | 'USD'
export type Unit = 'meters' | 'yards'

interface PreferencesState {
  currency: Currency
  unit: Unit
  setCurrency: (currency: Currency) => void
  setUnit: (unit: Unit) => void
  toggleCurrency: () => void
  toggleUnit: () => void
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      currency: 'PKR',
      unit: 'meters',
      setCurrency: (currency) => set({ currency }),
      setUnit: (unit) => set({ unit }),
      toggleCurrency: () =>
        set({ currency: get().currency === 'PKR' ? 'USD' : 'PKR' }),
      toggleUnit: () =>
        set({ unit: get().unit === 'meters' ? 'yards' : 'meters' }),
    }),
    {
      name: 'fabricport-preferences',
      partialize: (state) => ({
        currency: state.currency,
        unit: state.unit,
      }),
    },
  ),
)
