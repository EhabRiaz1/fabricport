import type { ColorFamily } from '@/lib/color/classify'
import type { Currency, Unit } from '@/stores/preferences'
import type {
  FabricAttribute,
  FabricCategory,
  Inquiry,
  InquiryItem,
  Invoice,
  Message,
  Payment,
  Product,
  ProductAttribute,
  Profile,
  SampleRequest,
  SampleRequestItem,
  Supplier,
  UserRole,
} from '@/types/database.types'

export type { UserRole } from '@/types/database.types'
export type { Currency, Unit } from '@/stores/preferences'

export interface ProductAttributeWithMeta extends ProductAttribute {
  attribute?: FabricAttribute
}

export interface ProductWithRelations extends Product {
  supplier?: Supplier
  category?: FabricCategory | null
  attributes?: ProductAttributeWithMeta[]
}

export interface SupplierWithCount extends Supplier {
  product_count: number
  profile?: Profile
}

export interface SupplierWithProfile extends Supplier {
  profile?: Profile
}

export type FabricCardVariant = 'featured' | 'grid' | 'compact'

export interface FabricCardProps {
  product: ProductWithRelations
  variant?: FabricCardVariant
  currency?: Currency
  unit?: Unit
  fxRate?: number
  onAddToCart?: (productId: string) => void
  className?: string
  /** Eager-load grid thumbnail (first page above the fold). */
  imagePriority?: boolean
}

export type MarketplaceSort = 'newest' | 'price_asc' | 'price_desc'

export interface MarketplaceFilters {
  categorySlug?: string
  colorFamilies?: ColorFamily[]
  supplierSlug?: string
  gsmMin?: number
  gsmMax?: number
  priceMin?: number
  priceMax?: number
  search?: string
  sort?: MarketplaceSort
}

export interface InquiryWithRelations extends Inquiry {
  buyer?: Profile
  supplier?: Supplier
  items?: InquiryItemWithProduct[]
  messages?: Message[]
  unread_count?: number
}

export interface InquiryItemWithProduct extends InquiryItem {
  product?: ProductWithRelations
}

export interface InvoiceWithRelations extends Invoice {
  buyer?: Profile
  supplier?: Supplier
  payments?: Payment[]
}

export interface SampleRequestWithRelations extends SampleRequest {
  buyer?: Profile
  supplier?: Supplier
  items?: SampleRequestItemWithProduct[]
}

export interface SampleRequestItemWithProduct extends SampleRequestItem {
  product?: ProductWithRelations
}

export interface CartItemWithProduct {
  id: string
  buyer_id: string
  product_id: string
  quantity_meters: number
  notes: string | null
  created_at: string
  product: ProductWithRelations
}

export interface CartGroupBySupplier {
  supplier: Supplier
  items: CartItemWithProduct[]
}

export interface ColorFieldValue {
  color_supplier_name: string | null
  color_display_name: string | null
  color_hex: string | null
  color_rgb: [number, number, number] | null
  color_family: ColorFamily | null
  color_sample: {
    image_index: number
    x: number
    y: number
  } | null
}

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  profile: Profile
}

export interface RouteGuardContext {
  role: UserRole | null
  status: Profile['status'] | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface PriceDisplay {
  min: number
  max: number
  currency: Currency
  unit: Unit
  formattedMin: string
  formattedMax: string
}

export interface ProductSpecRow {
  label: string
  value: string
}

export interface NotificationPayload {
  inquiry_id?: string
  sample_request_id?: string
  product_id?: string
  message_id?: string
  invoice_id?: string
  listing_request_id?: string
}

export interface VendorCardProps {
  supplier: SupplierWithCount
  className?: string
}

export interface ColorSamplerValue extends ColorFieldValue {
  suggested_family?: ColorFamily
}

export interface ListingRequestFormValues {
  category_id: string
  color_name: string
  rough_specs?: Record<string, string | number>
  supplier_notes?: string
}

export interface PortalNavItem {
  label: string
  href: string
  icon?: string
  badge?: number
  /**
   * Optional grouping heading. The nav array stays FLAT — PortalShell renders a
   * heading whenever this value changes between consecutive items, and consumers
   * that don't care about grouping (CommandPalette) ignore it. Keep items of the
   * same section adjacent, or the heading will repeat.
   */
  section?: string
}

export interface DashboardMetric {
  label: string
  value: number | string
  change?: number
  trend?: 'up' | 'down' | 'neutral'
}

export interface PresenceUser {
  user_id: string | null
  session_id: string | null
  page_path: string
  role?: UserRole
  full_name?: string | null
  last_seen: string
}

export interface FeaturedProduct extends ProductWithRelations {
  is_featured: true
}

export interface FabricFilterOption {
  slug: string
  label: string
  count?: number
}

export interface ColorFamilyFilterOption extends FabricFilterOption {
  slug: ColorFamily
  hex?: string
}

export type PublicPage =
  | '/'
  | '/marketplace'
  | '/fabric/:slug'
  | '/supplier/:slug'
  | '/vendors'
  | '/auth/login'
  | '/auth/register'

export type PortalZone = 'buyer' | 'supplier' | 'admin'

export interface BreadcrumbItem {
  label: string
  href?: string
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface ProductFormValues extends Partial<Product> {
  attribute_values?: Record<string, string | number | string[] | boolean>
  private_domains?: string[]
}

export interface SupplierDashboardStats {
  total_inquiries: number
  open_inquiries: number
  response_rate: number
  catalogue_views_week: number
  catalogue_views_month: number
}

export interface AdminDashboardStats {
  total_products: number
  active_suppliers: number
  registered_buyers: number
  inquiries_this_month: number
  live_users: number
  pending_listing_requests: number
  pending_price_approvals: number
}

export interface ImageGalleryItem {
  url: string
  alt: string
  index: number
}

export interface ChatThreadProps {
  inquiryId: string
  currentUserId: string
  messages: Message[]
  onSend: (content: string, attachments?: File[]) => Promise<void>
  readOnly?: boolean
}

export interface InvoiceBuilderLineItem {
  product_id: string
  title: string
  qty: number
  unit_price_pkr: number
  unit_price_usd: number
}

export interface SearchSuggestion {
  type: 'product' | 'supplier' | 'category'
  id: string
  label: string
  href: string
}

export interface RecentViewWithProduct {
  product_id: string
  viewed_at: string
  product: ProductWithRelations
}

export interface FxConversionContext {
  rate: number
  currency: Currency
}

export interface UnitConversionContext {
  unit: Unit
}

export interface MarketplaceViewState extends FxConversionContext, UnitConversionContext {
  filters: MarketplaceFilters
  sortBy?: 'newest' | 'price_asc' | 'price_desc' | 'popular'
}

export interface ColorClassificationResult {
  family: ColorFamily
  rgb: [number, number, number]
  hex: string
}

export interface SupplierCataloguePageProps {
  supplier: SupplierWithCount
  products: ProductWithRelations[]
  filters?: MarketplaceFilters
}

export interface ProductDetailPageProps {
  product: ProductWithRelations
  relatedProducts?: ProductWithRelations[]
}

export interface HomepageSectionProps {
  className?: string
}

export interface VizuShowcaseProps extends HomepageSectionProps {
  modelUrl?: string
  posterUrl?: string
}

export interface HeroSectionProps extends HomepageSectionProps {
  headline: string
  subheadline?: string
  ctaLabel?: string
  ctaHref?: string
  backgroundImage?: string
}

export interface TrustBarItem {
  label: string
  value: string
  numeric?: number
  prefix?: string
  suffix?: string
}

export interface AppError {
  code: string
  message: string
  details?: unknown
}

export interface ApiResult<T> {
  data: T | null
  error: AppError | null
}

export interface SessionContext {
  user: AuthUser | null
  isLoading: boolean
}

export interface RoleRedirectMap {
  admin: string
  supplier: string
  buyer: string
}

export const ROLE_HOME_PATHS: RoleRedirectMap = {
  admin: '/admin/dashboard',
  supplier: '/supplier-portal/dashboard',
  buyer: '/buyer/dashboard',
}

export const PUBLIC_AUTH_PATHS = ['/auth/login', '/auth/register'] as const

export type PublicAuthPath = (typeof PUBLIC_AUTH_PATHS)[number]

export function isPortalZone(pathname: string): PortalZone | null {
  if (pathname.startsWith('/admin')) return 'admin'
  if (pathname.startsWith('/supplier-portal')) return 'supplier'
  if (pathname.startsWith('/buyer')) return 'buyer'
  return null
}

export function requiresAuth(pathname: string): boolean {
  return isPortalZone(pathname) !== null
}

export function canAccessZone(role: UserRole, zone: PortalZone): boolean {
  // Strict: each role inhabits only its own portal zone. Admins do NOT silently
  // pass into the supplier/buyer portals — they operate from /admin. This is what
  // bounces an admin back out of a stale /supplier-portal URL (AuthGuard relies on it).
  return role === zone
}
