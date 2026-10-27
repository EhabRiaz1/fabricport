import { useEffect, useState, type FormEvent } from 'react'
import { ChangePasswordCard } from '@/components/shared/ChangePasswordCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useProfile } from '@/hooks/useProfile'
import { normalizePhone, phoneError } from '@/lib/phone'
import { supabase } from '@/lib/supabase'
import { toast } from '@/stores/toast'
import type { SupplierNotificationSettings } from '@/types/database.types'

const DEFAULT_NOTIFICATION_SETTINGS: SupplierNotificationSettings = {
  inquiry_received: { email: true, whatsapp: false, in_app: true },
  message_received: { email: true, whatsapp: true, in_app: true },
}

export default function SupplierSettingsPage() {
  const { profile, user, refreshProfile } = useProfile()
  const accountEmail = user?.email ?? ''
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [companyName, setCompanyName] = useState(profile?.company_name ?? '')
  const [phone, setPhone] = useState(profile?.phone_numbers?.[0]?.number ?? '')
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp_numbers?.[0]?.number ?? '')
  const [brandName, setBrandName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [notifications, setNotifications] = useState<SupplierNotificationSettings>(
    DEFAULT_NOTIFICATION_SETTINGS,
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!profile?.id) return

    setFullName(profile.full_name ?? '')
    setCompanyName(profile.company_name ?? '')
    setPhone(profile.phone_numbers?.[0]?.number ?? '')
    setWhatsapp(profile.whatsapp_numbers?.[0]?.number ?? '')

    async function loadSupplier() {
      const { data } = await supabase
        .from('suppliers')
        .select('brand_name, website_url, notification_settings')
        .eq('id', profile!.id)
        .maybeSingle()

      if (data) {
        setBrandName(data.brand_name)
        setWebsiteUrl(data.website_url ?? '')
        setNotifications(data.notification_settings ?? DEFAULT_NOTIFICATION_SETTINGS)
      }
    }

    loadSupplier()
  }, [profile?.id])

  const phoneProblem = phoneError(phone, 'Phone number')
  const whatsappProblem = phoneError(whatsapp, 'WhatsApp number')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile?.id) return
    if (phoneProblem || whatsappProblem) {
      const problem = phoneProblem ?? whatsappProblem ?? 'Invalid phone number'
      setError(problem)
      toast.error('Check the phone numbers', problem)
      return
    }

    setSaving(true)
    setMessage(null)
    setError(null)

    const phoneValue = normalizePhone(phone)
    const whatsappValue = normalizePhone(whatsapp)
    const [profileRes, supplierRes] = await Promise.all([
      supabase
        .from('profiles')
        .update({
          full_name: fullName.trim() || null,
          company_name: companyName.trim() || null,
          phone_numbers: phoneValue ? [{ label: 'primary', number: phoneValue }] : [],
          whatsapp_numbers: whatsappValue
            ? [{ label: 'primary', number: whatsappValue, primary: true }]
            : [],
        })
        .eq('id', profile.id),
      supabase
        .from('suppliers')
        .update({
          brand_name: brandName.trim() || profile.company_name || 'Supplier',
          website_url: websiteUrl.trim() || null,
          notification_settings: notifications,
        })
        .eq('id', profile.id),
    ])

    if (profileRes.error || supplierRes.error) {
      const problem = profileRes.error?.message ?? supplierRes.error?.message ?? 'Update failed'
      setError(problem)
      toast.error('Could not save settings', problem)
    } else {
      setMessage('Settings saved successfully.')
      toast.success('Settings saved')
      await refreshProfile()
    }
    setSaving(false)
  }

  function toggleNotification(
    event: keyof SupplierNotificationSettings,
    channel: 'email' | 'whatsapp' | 'in_app',
  ) {
    setNotifications((prev) => ({
      ...prev,
      [event]: {
        ...prev[event],
        [channel]: !prev[event][channel],
      },
    }))
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-accent">Settings</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
          Profile & Notifications
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-text-dark">Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="accountEmail" className="text-text-dark">
                  Account Email
                </Label>
                <Input
                  id="accountEmail"
                  type="email"
                  value={accountEmail}
                  readOnly
                  disabled
                  className="border-border-cream bg-card-hover text-text-dark-secondary"
                />
                <p className="text-xs text-text-dark-secondary">
                  This is the email you sign in with. Contact support to change it.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-text-dark">
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="border-border-cream bg-card-hover text-text-dark"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-text-dark">
                  Company Name
                </Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="border-border-cream bg-card-hover text-text-dark"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-text-dark">
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+92 300 0000000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    aria-invalid={Boolean(phoneProblem)}
                    className="border-border-cream bg-card-hover text-text-dark"
                  />
                  {phoneProblem && <p className="text-xs text-danger">{phoneProblem}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp" className="text-text-dark">
                    WhatsApp
                  </Label>
                  <Input
                    id="whatsapp"
                    type="tel"
                    placeholder="+92 300 0000000"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    aria-invalid={Boolean(whatsappProblem)}
                    className="border-border-cream bg-card-hover text-text-dark"
                  />
                  {whatsappProblem && <p className="text-xs text-danger">{whatsappProblem}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="brandName" className="text-text-dark">
                  Brand Name
                </Label>
                <Input
                  id="brandName"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="border-border-cream bg-card-hover text-text-dark"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="websiteUrl" className="text-text-dark">
                  Website
                </Label>
                <Input
                  id="websiteUrl"
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="border-border-cream bg-card-hover text-text-dark"
                />
              </div>
            </div>

            <div className="border-t border-border-cream pt-6">
              <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                Notification Preferences
              </p>
              {(
                [
                  ['inquiry_received', 'New Inquiry Received'],
                  ['message_received', 'New Message Received'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="mb-4 space-y-2">
                  <p className="text-sm font-medium text-text-dark">{label}</p>
                  <div className="flex flex-wrap gap-4">
                    {(['email', 'whatsapp', 'in_app'] as const).map((channel) => (
                      <label
                        key={channel}
                        className="flex cursor-pointer items-center gap-2 text-sm text-text-dark-secondary"
                      >
                        <input
                          type="checkbox"
                          checked={notifications[key][channel]}
                          onChange={() => toggleNotification(key, channel)}
                          className="accent-accent"
                        />
                        {channel === 'in_app' ? 'In-app' : channel.charAt(0).toUpperCase() + channel.slice(1)}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {message && <p className="text-sm text-success">{message}</p>}
            {error && <p className="text-sm text-danger">{error}</p>}

            <Button type="submit" disabled={saving || Boolean(phoneProblem || whatsappProblem)}>
              {saving ? 'Saving…' : 'Save Settings'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {accountEmail && <ChangePasswordCard email={accountEmail} />}
    </div>
  )
}
