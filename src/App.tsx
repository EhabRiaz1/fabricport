import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { SmoothScroll } from '@/components/layout/SmoothScroll'
import { AuthGuard } from '@/components/shared/AuthGuard'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { Toaster } from '@/components/ui/toaster'
import { PortalShell } from '@/components/layout/PortalShell'
import { WishlistSync } from '@/components/marketplace/WishlistSync'
import HomePage from '@/pages/public/HomePage'
import MarketplacePage from '@/pages/public/MarketplacePage'
import FabricDetailPage from '@/pages/public/FabricDetailPage'
import SupplierPage from '@/pages/public/SupplierPage'
import VendorsPage from '@/pages/public/VendorsPage'
import SellPage from '@/pages/public/SellPage'
import CataloguePage from '@/pages/public/CataloguePage'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import PendingPage from '@/pages/auth/PendingPage'
import DashboardPage from '@/pages/admin/DashboardPage'
import ProductsPage from '@/pages/admin/ProductsPage'
import ProductFormPage from '@/pages/admin/ProductFormPage'
import SuppliersPage from '@/pages/admin/SuppliersPage'
import BuyersPage from '@/pages/admin/BuyersPage'
import UsersPage from '@/pages/admin/UsersPage'
import AdminMessagesPage from '@/pages/admin/MessagesPage'
import AdminBillingPage from '@/pages/admin/BillingPage'
import AdminReportsPage from '@/pages/admin/ReportsPage'
import AdminCategoriesPage from '@/pages/admin/CategoriesPage'
import AdminSampleRequestsPage from '@/pages/admin/SampleRequestsPage'
import LiveMonitorPage from '@/pages/admin/LiveMonitorPage'
import SupportPage from '@/pages/shared/SupportPage'
import ListingPipelinePage from '@/pages/admin/ListingPipelinePage'
import AttributesPage from '@/pages/admin/AttributesPage'
import InquiriesPage from '@/pages/admin/InquiriesPage'
import InquiryDetailPage from '@/pages/admin/InquiryDetailPage'
import SettingsPage from '@/pages/admin/SettingsPage'
import BuyerDashboardPage from '@/pages/buyer/DashboardPage'
import BuyerCartPage from '@/pages/buyer/CartPage'
import BuyerWishlistPage from '@/pages/buyer/WishlistPage'
import BuyerInquiriesPage from '@/pages/buyer/InquiriesPage'
import BuyerInquiryDetailPage from '@/pages/buyer/InquiryDetailPage'
import BuyerInvoicesPage from '@/pages/buyer/InvoicesPage'
import BuyerInvoiceDetailPage from '@/pages/buyer/InvoiceDetailPage'
import BuyerSampleRequestsPage from '@/pages/buyer/SampleRequestsPage'
import BuyerSampleRequestDetailPage from '@/pages/buyer/SampleRequestDetailPage'
import BuyerSettingsPage from '@/pages/buyer/SettingsPage'
import SupplierDashboardPage from '@/pages/supplier/DashboardPage'
import SupplierAnalyticsPage from '@/pages/supplier/AnalyticsPage'
import SupplierInventoryPage from '@/pages/supplier/InventoryPage'
import SupplierCataloguesPage from '@/pages/supplier/CataloguesPage'
import SupplierInquiriesPage from '@/pages/supplier/InquiriesPage'
import SupplierInquiryDetailPage from '@/pages/supplier/InquiryDetailPage'
import SupplierInvoicesPage from '@/pages/supplier/InvoicesPage'
import SupplierSampleRequestsPage from '@/pages/supplier/SampleRequestsPage'
import SupplierSampleRequestDetailPage from '@/pages/supplier/SampleRequestDetailPage'
import ListingRequestPage from '@/pages/supplier/ListingRequestPage'
import InvoiceBuilderPage from '@/pages/supplier/InvoiceBuilderPage'
import SupplierSettingsPage from '@/pages/supplier/SettingsPage'
import PendingApprovalPage from '@/pages/supplier/PendingApprovalPage'

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
  return (
    <ErrorBoundary>
      <AuthProvider>
        <WishlistSync />
        <BrowserRouter>
        <SmoothScroll>
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
        </SmoothScroll>
        <Toaster />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}
