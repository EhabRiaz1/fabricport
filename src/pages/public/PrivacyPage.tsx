import { LegalLayout } from '@/components/layout/LegalLayout'

/**
 * Privacy Policy. Wording is the client's own document (Oct 2026) and must not
 * be edited here without their sign-off; only the typesetting is ours.
 */
export default function PrivacyPage() {
  return (
    <LegalLayout eyebrow="Legal" title="Privacy Policy" meta="Effective date: 27 October 2026">
      <title>Privacy Policy · FabricPort</title>
      <meta
        name="description"
        content="How FabricPort collects, uses and protects the data of buyers, suppliers and visitors."
      />

      <h2>1. Introduction</h2>
      <p>
        Fabricport ("we," "our," or "us") is committed to protecting the privacy and data of our
        users, including buyers, suppliers, and visitors of the platform. This Privacy Policy
        explains what data we collect, how we use it, and the rights of our users. By using our
        platform, you agree to the terms outlined here.
      </p>

      <h2>2. Information We Collect</h2>
      <h3>A. Personal Information</h3>
      <ul>
        <li>Buyers &amp; Suppliers: Name, company name, email, phone number, business address.</li>
        <li>Payment Information: Secure billing and payment details.</li>
        <li>Login Credentials: Passwords are encrypted for security.</li>
      </ul>
      <h3>B. Business Data</h3>
      <ul>
        <li>Supplier Information: Stock fabric details, pricing, and availability.</li>
        <li>Buyer Activity: Orders, inquiries, and transaction history.</li>
      </ul>
      <h3>C. Automated Data Collection</h3>
      <ul>
        <li>Cookies &amp; Tracking: IP addresses, device details, and browsing behavior.</li>
        <li>Usage Analytics: Search history, preferences, and interactions.</li>
      </ul>

      <h2>3. How We Use Your Information</h2>
      <p>Fabricport uses collected data for:</p>
      <ul>
        <li>Platform Functionality: Enabling order placements, inquiries, and transactions.</li>
        <li>Buyer-Supplier Communication: Facilitating direct messaging and queries.</li>
        <li>Order &amp; Query Management: Ensuring timely responses and supplier accountability.</li>
        <li>Security &amp; Fraud Prevention: Protecting against fraudulent activity.</li>
      </ul>

      <h2>4. Supplier Response Time Policy</h2>
      <ul>
        <li>Suppliers must respond to buyer queries within 1 business day.</li>
        <li>
          If a supplier fails to respond within the given time, the query will be automatically
          shifted to another supplier to maintain efficiency and buyer satisfaction.
        </li>
        <li>
          Repeated failure to respond may lead to temporary suspension or removal from the
          platform.
        </li>
      </ul>

      <h2>5. How We Share Information</h2>
      <p>
        Fabricport does not sell or trade user data but may share information in the following
        cases:
      </p>
      <ul>
        <li>With Suppliers/Buyers: Contact details are shared only after an inquiry is initiated.</li>
        <li>With Third-Party Services: Payment processors, analytics providers, and logistics partners.</li>
        <li>For Legal &amp; Compliance Purposes: If required by law enforcement or regulatory authorities.</li>
      </ul>

      <h2>6. Data Security &amp; Storage</h2>
      <p>Fabricport implements industry-standard security measures, including:</p>
      <ul>
        <li>Encryption &amp; Secure Transactions to protect sensitive data.</li>
        <li>Access Control &amp; Authentication to restrict unauthorized use.</li>
        <li>
          Data Retention Policy: User data is stored only as long as necessary for business and
          legal compliance.
        </li>
      </ul>

      <h2>7. Cookies &amp; Tracking</h2>
      <p>We use cookies, tracking pixels, and analytics tools to improve user experience. Users can:</p>
      <ul>
        <li>Opt out of cookies through browser settings.</li>
        <li>Control ad preferences related to targeted marketing.</li>
      </ul>

      <h2>8. User Rights &amp; Choices</h2>
      <p>Users have the right to:</p>
      <ul>
        <li>Access, edit, or delete their data upon request.</li>
        <li>Unsubscribe from marketing communications at any time.</li>
        <li>Request account deletion by contacting support.</li>
      </ul>

      <h2>9. Third-Party Links &amp; Integrations</h2>
      <p>
        Fabricport may integrate with payment gateways, analytics tools, or external verification
        services. We are not responsible for third-party privacy policies and encourage users to
        review them separately.
      </p>

      <h2>10. Updates to Privacy Policy</h2>
      <p>
        We may update this policy periodically. Users will be notified of any significant changes
        via email or platform notifications.
      </p>

      <h2>11. Contact Information</h2>
      <p>For any privacy-related questions or concerns, please contact us at:</p>
      <p>
        <a href="mailto:support@fabricport.com">support@fabricport.com</a>
      </p>
    </LegalLayout>
  )
}
