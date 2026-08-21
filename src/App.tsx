import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { SmoothScroll } from '@/components/layout/SmoothScroll'
import { AuthGuard } from '@/components/shared/AuthGuard'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { Toaster } from '@/components/ui/toaster'
import { PortalShell } from '@/components/layout/PortalShell'
import { WishlistSync } from '@/components/marketplace/WishlistSync'
import { CartSync } from '@/components/cart/CartSync'
import { CartDrawer } from '@/components/cart/CartDrawer'
import { SupportWidget } from '@/components/support/SupportWidget'
const HomePage = lazy(() => import('@/pages/public/HomePage'))
const MarketplacePage = lazy(() => import('@/pages/public/MarketplacePage'))
const FabricDetailPage = lazy(() => import('@/pages/public/FabricDetailPage'))
const SupplierPage = lazy(() => import('@/pages/public/SupplierPage'))
const VendorsPage = lazy(() => import('@/pages/public/VendorsPage'))
const SellPage = lazy(() => import('@/pages/public/SellPage'))
const CataloguePage = lazy(() => import('@/pages/public/CataloguePage'))
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'))
const PendingPage = lazy(() => import('@/pages/auth/PendingPage'))
const DashboardPage = lazy(() => import('@/pages/admin/DashboardPage'))
const ProductsPage = lazy(() => import('@/pages/admin/ProductsPage'))
const ProductFormPage = lazy(() => import('@/pages/admin/ProductFormPage'))
const SuppliersPage = lazy(() => import('@/pages/admin/SuppliersPage'))
const BuyersPage = lazy(() => import('@/pages/admin/BuyersPage'))
const UsersPage = lazy(() => import('@/pages/admin/UsersPage'))
const AdminMessagesPage = lazy(() => import('@/pages/admin/MessagesPage'))
const AdminBillingPage = lazy(() => import('@/pages/admin/BillingPage'))
const AdminReportsPage = lazy(() => import('@/pages/admin/ReportsPage'))
const AdminCategoriesPage = lazy(() => import('@/pages/admin/CategoriesPage'))
const AdminSampleRequestsPage = lazy(() => import('@/pages/admin/SampleRequestsPage'))
const LiveMonitorPage = lazy(() => import('@/pages/admin/LiveMonitorPage'))
const SupportPage = lazy(() => import('@/pages/shared/SupportPage'))
const ListingPipelinePage = lazy(() => import('@/pages/admin/ListingPipelinePage'))
const AttributesPage = lazy(() => import('@/pages/admin/AttributesPage'))
const InquiriesPage = lazy(() => import('@/pages/admin/InquiriesPage'))
const InquiryDetailPage = lazy(() => import('@/pages/admin/InquiryDetailPage'))
const SettingsPage = lazy(() => import('@/pages/admin/SettingsPage'))
const BuyerDashboardPage = lazy(() => import('@/pages/buyer/DashboardPage'))
const BuyerCartPage = lazy(() => import('@/pages/buyer/CartPage'))
const BuyerWishlistPage = lazy(() => import('@/pages/buyer/WishlistPage'))
const BuyerInquiriesPage = lazy(() => import('@/pages/buyer/InquiriesPage'))
const BuyerInquiryDetailPage = lazy(() => import('@/pages/buyer/InquiryDetailPage'))
const BuyerInvoicesPage = lazy(() => import('@/pages/buyer/InvoicesPage'))
const BuyerInvoiceDetailPage = lazy(() => import('@/pages/buyer/InvoiceDetailPage'))
const BuyerSampleRequestsPage = lazy(() => import('@/pages/buyer/SampleRequestsPage'))
const BuyerSampleRequestDetailPage = lazy(() => import('@/pages/buyer/SampleRequestDetailPage'))
const BuyerSettingsPage = lazy(() => import('@/pages/buyer/SettingsPage'))
const SupplierDashboardPage = lazy(() => import('@/pages/supplier/DashboardPage'))
const SupplierAnalyticsPage = lazy(() => import('@/pages/supplier/AnalyticsPage'))
const SupplierInventoryPage = lazy(() => import('@/pages/supplier/InventoryPage'))
const SupplierCataloguesPage = lazy(() => import('@/pages/supplier/CataloguesPage'))
const SupplierInquiriesPage = lazy(() => import('@/pages/supplier/InquiriesPage'))
const SupplierInquiryDetailPage = lazy(() => import('@/pages/supplier/InquiryDetailPage'))
const SupplierInvoicesPage = lazy(() => import('@/pages/supplier/InvoicesPage'))
const SupplierSampleRequestsPage = lazy(() => import('@/pages/supplier/SampleRequestsPage'))
const SupplierSampleRequestDetailPage = lazy(() => import('@/pages/supplier/SampleRequestDetailPage'))
const ListingRequestPage = lazy(() => import('@/pages/supplier/ListingRequestPage'))
const InvoiceBuilderPage = lazy(() => import('@/pages/supplier/InvoiceBuilderPage'))
const SupplierSettingsPage = lazy(() => import('@/pages/supplier/SettingsPage'))
const PendingApprovalPage = lazy(() => import('@/pages/supplier/PendingApprovalPage'))

/**
 * Deliberately not a spinner. Route chunks land in well under 200ms on a warm connection,
 * and a spinner that flashes for 150ms reads as jank; a still cream field reads as nothing
 * happening at all, which is the goal.
 */
function RouteFallback() {
  return (
    <div className="min-h-screen bg-[#F6F1E9]" aria-busy="true">
      <span className="sr-only">Loading page</span>
    </div>
  )
}

/**
 * A lazy chunk that 404s after a deploy (the user's tab is running the previous build)
 * throws straight into the app-level ErrorBoundary and blanks the whole app. Reload once to
 * pick up the new manifest, guarded by a session flag so a genuinely broken deploy cannot
 * put us in a reload loop.
 */
function useStaleChunkRecovery() {
  useEffect(() => {
    const onPreloadError = (event: Event) => {
      event.preventDefault()
      if (sessionStorage.getItem('fp-chunk-reloaded') === '1') return
      sessionStorage.setItem('fp-chunk-reloaded', '1')
      window.location.reload()
    }
    window.addEventListener('vite:preloadError', onPreloadError)
    return () => window.removeEventListener('vite:preloadError', onPreloadError)
  }, [])
}

function PortalPlaceholder({ title }: { title: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
      <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
        {title}
      </p>
      <p className="mt-2 text-sm text-text-secondary">Coming soon</p>
    </div>
  )
}

export default function App() {
  useStaleChunkRecovery()

  return (
    <ErrorBoundary>
      <AuthProvider>
        <WishlistSync />
        <CartSync />
        <BrowserRouter>
        <SmoothScroll>
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/marketplace" element={<MarketplacePage />} />
            <Route path="/sell" element={<SellPage />} />
            <Route path="/fabric/:slug" element={<FabricDetailPage />} />
            <Route path="/supplier/:slug" element={<SupplierPage />} />
            <Route path="/vendors" element={<VendorsPage />} />
            <Route path="/c/:token" element={<CataloguePage />} />
            <Route path="/auth/login" element={<LoginPage />} />
            <Route path="/auth/register" element={<RegisterPage />} />
            <Route
              path="/auth/pending"
              element={
                <AuthGuard requireActive={false}>
                  <PendingPage />
                </AuthGuard>
              }
            />

            <Route
              path="/buyer/*"
              element={
                <AuthGuard zone="buyer">
                  <PortalShell zone="buyer">
                    <Outlet />
                  </PortalShell>
                </AuthGuard>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<BuyerDashboardPage />} />
              <Route path="cart" element={<BuyerCartPage />} />
              <Route path="wishlist" element={<BuyerWishlistPage />} />
              <Route path="inquiries" element={<BuyerInquiriesPage />} />
              <Route path="inquiries/:id" element={<BuyerInquiryDetailPage />} />
              <Route path="samples" element={<BuyerSampleRequestsPage />} />
              <Route path="samples/:id" element={<BuyerSampleRequestDetailPage />} />
              <Route path="invoices" element={<BuyerInvoicesPage />} />
              <Route path="invoices/:id" element={<BuyerInvoiceDetailPage />} />
              <Route path="support" element={<SupportPage />} />
              <Route path="settings" element={<BuyerSettingsPage />} />
              <Route path="*" element={<PortalPlaceholder title="Buyer Portal" />} />
            </Route>

            <Route
              path="/supplier-portal/pending"
              element={
                <AuthGuard zone="supplier" requireActive={false}>
                  <PendingApprovalPage />
                </AuthGuard>
              }
            />

            <Route
              path="/supplier-portal/*"
              element={
                <AuthGuard zone="supplier">
                  <PortalShell zone="supplier">
                    <Outlet />
                  </PortalShell>
                </AuthGuard>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<SupplierDashboardPage />} />
              <Route path="analytics" element={<SupplierAnalyticsPage />} />
              <Route path="inventory" element={<SupplierInventoryPage />} />
              <Route path="catalogues" element={<SupplierCataloguesPage />} />
              <Route path="inquiries" element={<SupplierInquiriesPage />} />
              <Route path="inquiries/:id" element={<SupplierInquiryDetailPage />} />
              <Route path="samples" element={<SupplierSampleRequestsPage />} />
              <Route path="samples/:id" element={<SupplierSampleRequestDetailPage />} />
              <Route path="listing-request" element={<ListingRequestPage />} />
              <Route path="invoices" element={<SupplierInvoicesPage />} />
              <Route path="invoices/new" element={<InvoiceBuilderPage />} />
              <Route path="support" element={<SupportPage />} />
              <Route path="settings" element={<SupplierSettingsPage />} />
              <Route path="*" element={<PortalPlaceholder title="Supplier Portal" />} />
            </Route>

            <Route
              path="/admin/*"
              element={
                <AuthGuard zone="admin">
                  <PortalShell zone="admin">
                    <Outlet />
                  </PortalShell>
                </AuthGuard>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="live" element={<LiveMonitorPage />} />
              <Route path="messages" element={<AdminMessagesPage />} />
              <Route path="billing" element={<AdminBillingPage />} />
              <Route path="reports" element={<AdminReportsPage />} />
              <Route path="categories" element={<AdminCategoriesPage />} />
              <Route path="samples" element={<AdminSampleRequestsPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="products/new" element={<ProductFormPage />} />
              <Route path="products/:id/edit" element={<ProductFormPage />} />
              <Route path="suppliers" element={<SuppliersPage />} />
              <Route path="buyers" element={<BuyersPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="listing-pipeline" element={<ListingPipelinePage />} />
              <Route path="attributes" element={<AttributesPage />} />
              <Route path="inquiries" element={<InquiriesPage />} />
              <Route path="inquiries/:id" element={<InquiryDetailPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="dashboard" replace />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </SmoothScroll>
        {/* Inside BrowserRouter: the drawer navigates after submitting. */}
        <CartDrawer />
        <SupportWidget />
        <Toaster />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}
