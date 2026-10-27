import { useEffect, useState, type FormEvent } from 'react'
import { AddressBook } from '@/components/buyer/AddressBook'
import { ChangePasswordCard } from '@/components/shared/ChangePasswordCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useProfile } from '@/hooks/useProfile'
import { normalizePhone, phoneError } from '@/lib/phone'
import { supabase } from '@/lib/supabase'
import { toast } from '@/stores/toast'

export default function BuyerSettingsPage() {
  const { profile, user, refreshProfile } = useProfile()
  const accountEmail = user?.email ?? ''
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!profile) return
    setFullName(profile.full_name ?? '')
    setCompanyName(profile.company_name ?? '')
    setPhone(profile.phone_numbers?.[0]?.number ?? '')
    setWhatsapp(profile.whatsapp_numbers?.[0]?.number ?? '')
  }, [profile])

  const phoneProblem = phoneError(phone, 'Phone number')
  const whatsappProblem = phoneError(whatsapp, 'WhatsApp number')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile?.id) return
    if (phoneProblem || whatsappProblem) {
      toast.error('Check the phone numbers', phoneProblem ?? whatsappProblem ?? undefined)
      return
    }

    setSaving(true)

    const phoneValue = normalizePhone(phone)
    const whatsappValue = normalizePhone(whatsapp)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim() || null,
        company_name: companyName.trim() || null,
        phone_numbers: phoneValue ? [{ label: 'primary', number: phoneValue }] : [],
        whatsapp_numbers: whatsappValue
          ? [{ label: 'primary', number: whatsappValue, primary: true }]
          : [],
      })
      .eq('id', profile.id)

    if (updateError) {
      toast.error('Could not save profile', updateError.message)
    } else {
      toast.success('Profile updated')
      await refreshProfile()
    }
    setSaving(false)
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-accent">Settings</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">Profile</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-text-dark">Account Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <p className="text-xs leading-relaxed text-text-dark-secondary">
              Your WhatsApp number is used for inquiry and message notifications
              once WhatsApp alerts are enabled for your account.
            </p>
            <Button type="submit" disabled={saving || Boolean(phoneProblem || whatsappProblem)}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {accountEmail && <ChangePasswordCard email={accountEmail} />}

      {profile?.id && <AddressBook buyerId={profile.id} />}
    </div>
  )
}
