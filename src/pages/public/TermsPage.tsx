import { Link } from 'react-router-dom'
import { LegalLayout } from '@/components/layout/LegalLayout'

/**
 * Terms of Service. The client has not supplied final wording yet (the previous
 * site's page was also a placeholder), so this is an honest holding page rather
 * than invented legal text. Swap the body for the real terms when they arrive.
 */
export default function TermsPage() {
  return (
    <LegalLayout eyebrow="Legal" title="Terms of Service" meta="Last updated: 27 October 2026">
      <title>Terms of Service · FabricPort</title>
      <meta
        name="description"
        content="Terms governing the use of the FabricPort B2B fabric marketplace by buyers and suppliers."
      />

      <p>
        Our full Terms of Service are being finalised and will be published on this page. How we
        handle your data is set out in our <Link to="/privacy">Privacy Policy</Link>.
      </p>

      <h2>Questions</h2>
      <p>
        For anything about these terms, contact{' '}
        <a href="mailto:support@fabricport.com">support@fabricport.com</a>.
      </p>
    </LegalLayout>
  )
}
