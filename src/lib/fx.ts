import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getSetting } from '@/lib/settings'

/**
 * USD→PKR rate. An admin override in app_settings `fx_override` wins when set; otherwise
 * the latest `fx_rates` row (written by the refresh-fx-rates function).
 *
 * There is deliberately NO hardcoded fallback rate any more. The old 278 default was
 * live on the marketplace for the first render of every page and for the whole session
 * whenever the fetch failed, while Settings and the invoice builder used the real rate --
 * which is how the same fabric showed two different dollar prices. With no rate loaded,
 * callers show PKR instead of a guess.
 */

let cachedRate: { value: number; fetchedAt: number } | null = null
let inflight: Promise<number> | null = null
const listeners = new Set<(rate: number) => void>()
const CACHE_TTL_MS = 60 * 60 * 1000

/** Resolves the rate, or rejects when none is available. Never invents one. */
export async function getFxRate(forceRefresh = false): Promise<number> {
  if (!forceRefresh && cachedRate && Date.now() - cachedRate.fetchedAt < CACHE_TTL_MS) {
    return cachedRate.value
  }
  if (inflight && !forceRefresh) return inflight

  inflight = (async () => {
    // A manual override from /admin/settings wins over the fetched rate. Any failure
    // reading it (including app_settings not existing yet) falls through to fx_rates.
    const override = await getSetting('fx_override').catch(() => null)
    const overrideRate = Number(override?.rate)
    if (overrideRate > 0) {
      cachedRate = { value: overrideRate, fetchedAt: Date.now() }
      listeners.forEach((fn) => fn(overrideRate))
      return overrideRate
    }

    const { data, error } = await supabase
      .from('fx_rates')
      .select('rate, fetched_at')
      .eq('base', 'USD')
      .eq('target', 'PKR')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      if (cachedRate) return cachedRate.value
      throw new Error(`Exchange rate unavailable: ${error.message}`)
    }
    const rate = Number(data?.rate)
    if (!(rate > 0)) {
      if (cachedRate) return cachedRate.value
      throw new Error('Exchange rate unavailable')
    }
    cachedRate = { value: rate, fetchedAt: Date.now() }
    listeners.forEach((fn) => fn(rate))
    return rate
  })()

  try {
    return await inflight
  } finally {
    inflight = null
  }
}

/** Synchronous read of whatever is cached; null before the first successful fetch. */
export function getCachedFxRate(): number | null {
  return cachedRate?.value ?? null
}

/**
 * The live USD→PKR rate for components. Null until loaded (show PKR meanwhile); updates
 * every subscriber the moment a refresh lands, so the admin "Refresh" button is reflected
 * everywhere without a reload.
 */
export function useFxRate(): number | null {
  const [rate, setRate] = useState<number | null>(getCachedFxRate)

  useEffect(() => {
    listeners.add(setRate)
    getFxRate().then(setRate).catch(() => undefined)
    return () => {
      listeners.delete(setRate)
    }
  }, [])

  return rate
}

export function convertPkrToUsd(pkr: number, rate: number): number {
  if (rate <= 0) return 0
  return pkr / rate
}

export function convertUsdToPkr(usd: number, rate: number): number {
  return usd * rate
}

export function convertPrice(
  amount: number,
  from: 'PKR' | 'USD',
  to: 'PKR' | 'USD',
  rate: number,
): number {
  if (from === to) return amount
  return from === 'PKR' ? convertPkrToUsd(amount, rate) : convertUsdToPkr(amount, rate)
}
