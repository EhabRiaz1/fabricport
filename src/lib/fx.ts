import { supabase } from '@/lib/supabase'

const DEFAULT_USD_TO_PKR = 278

let cachedRate: { value: number; fetchedAt: number } | null = null
const CACHE_TTL_MS = 6 * 60 * 60 * 1000

export async function getFxRate(forceRefresh = false): Promise<number> {
  if (!forceRefresh && cachedRate && Date.now() - cachedRate.fetchedAt < CACHE_TTL_MS) {
    return cachedRate.value
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
    console.warn('Failed to fetch FX rate, using fallback:', error.message)
    return cachedRate?.value ?? DEFAULT_USD_TO_PKR
  }

  const rate = data?.rate ?? DEFAULT_USD_TO_PKR
  cachedRate = { value: Number(rate), fetchedAt: Date.now() }
  return cachedRate.value
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
