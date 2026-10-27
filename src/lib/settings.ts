import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/**
 * Key/value platform settings (`public.app_settings`). Readable by everyone,
 * writable by admins (RLS). Values are JSON.
 *
 * The table is deliberately not in the generated Database type: it is a small
 * JSON bag whose shape is owned per key by the modules below.
 */

/** Manual USD→PKR override set from /admin/settings. `null` = use fx_rates. */
export interface FxOverride {
  rate: number
  note: string | null
  set_by: string | null
  set_at: string
}

export interface InvoiceDefaults {
  tax_rate_percent: number
  tax_mode: 'total' | 'per_line'
  freight_pkr: number
  payment_terms: string
}

export interface SettingsMap {
  fx_override: FxOverride | null
  invoice_defaults: InvoiceDefaults
  invoice_payment_terms_options: string[]
}

// Fallbacks used when a key is missing. They match the seed rows in
// 20261027150000_app_settings_and_invoice_terms.sql.
export const DEFAULT_INVOICE_DEFAULTS: InvoiceDefaults = {
  tax_rate_percent: 18,
  tax_mode: 'total',
  freight_pkr: 0,
  payment_terms: 'Net 30',
}

export const DEFAULT_PAYMENT_TERMS_OPTIONS = [
  'Advance',
  'Net 7',
  'Net 15',
  'Net 30',
  'Net 45',
  'Net 60',
  'Against delivery',
]

// SupabaseClient with its default (untyped) schema so `from('app_settings')`
// and ad-hoc RPC names compile without touching database.types.ts.
const untyped = supabase as unknown as SupabaseClient

/**
 * app_settings.value is `jsonb not null`, and PostgREST turns a JSON `null` in a
 * request body into SQL NULL, so "no value" cannot be written as null. A cleared
 * setting is stored as this marker instead; getSetting reads it (and a JSON null
 * seed row) back as `null`.
 */
const CLEARED = { cleared: true } as const

function isCleared(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'object' &&
      !Array.isArray(value) &&
      (value as Record<string, unknown>).cleared === true)
  )
}

export async function getSetting<K extends keyof SettingsMap>(
  key: K,
): Promise<SettingsMap[K] | null> {
  const { data, error } = await untyped
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const value = data?.value
  return (isCleared(value) ? null : value) as SettingsMap[K] | null
}

export async function setSetting<K extends keyof SettingsMap>(
  key: K,
  value: SettingsMap[K],
): Promise<void> {
  const { error } = await untyped
    .from('app_settings')
    .upsert(
      { key, value: value === null ? { ...CLEARED, at: new Date().toISOString() } : value, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    )
  if (error) throw new Error(error.message)
}

/** Calls an RPC that is not (yet) declared in database.types.ts. */
export async function callRpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await untyped.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}
