import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Currency = 'PKR' | 'USD'
export type Unit = 'meters' | 'yards'
/** How the supplier portal renders its own catalogue. */
export type InventoryView = 'grid' | 'list'

interface PreferencesState {
  currency: Currency
  unit: Unit
  inventoryView: InventoryView
  setCurrency: (currency: Currency) => void
  setUnit: (unit: Unit) => void
  setInventoryView: (view: InventoryView) => void
  toggleCurrency: () => void
  toggleUnit: () => void
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      currency: 'PKR',
      unit: 'meters',
      // Grid by default: it is how the supplier's own buyers see the catalogue, and it
      // fits a whole page of fabrics where the editable list fits three.
      inventoryView: 'grid',
      setCurrency: (currency) => set({ currency }),
      setUnit: (unit) => set({ unit }),
      setInventoryView: (inventoryView) => set({ inventoryView }),
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
        inventoryView: state.inventoryView,
      }),
    },
  ),
)
