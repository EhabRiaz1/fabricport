export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'admin' | 'supplier' | 'buyer'
export type ProfileStatus = 'pending' | 'active' | 'suspended'
export type FabricAttributeType =
  | 'text'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'boolean'
  | 'range'
export type ProductStatus =
  | 'draft'
  | 'pending_listing_request'
  | 'fabric_received'
  | 'scanning'
  | 'ready_to_publish'
  | 'published'
  | 'archived'
export type ProductVisibility = 'public' | 'private'

/** Independent lab test outcome. Admin-set; suppliers cannot self-certify. */
export type TestReportStatus = 'approved' | 'failed'
export type ListingRequestStatus =
  | 'submitted'
  | 'fabric_received'
  | 'scanning'
  | 'complete'
  | 'rejected'
export type InquiryStatus = 'open' | 'responded' | 'negotiating' | 'closed' | 'archived'

/**
 * Sibling of InquiryStatus, deliberately NOT folded into it: 10 files depend on
 * InquiryStatus' current members, and a sample follows a linear fulfilment path
 * rather than a negotiation. Keep in step with the sample_requests CHECK
 * constraint and the guard_sample_request_columns trigger.
 */
export type SampleRequestStatus =
  | 'requested'
  | 'approved'
  | 'shipped'
  | 'delivered'
  | 'declined'
  | 'cancelled'

/** Address as captured at request time. Frozen; never re-read from the address book. */
export interface ShipToSnapshot {
  recipient_name: string
  phone?: string | null
  line1: string
  line2?: string | null
  city: string
  province?: string | null
  postal_code?: string | null
  country?: string | null
}
export type InvoiceStatus = 'draft' | 'sent' | 'acknowledged' | 'cancelled'

/** Separate axis from InvoiceStatus: an invoice can be `sent` and `partial`. */
export type PaymentStatus = 'unpaid' | 'partial' | 'paid'

export type PaymentMethod = 'bank_transfer' | 'cash' | 'cheque' | 'card' | 'other'

/** Shape returned by the get_admin_report_stats RPC. */
export interface AdminReportStats {
  inquiries_per_week: { week: string; count: number }[]
  supplier_response_rate: number | null
  median_first_response_hours: number | null
  overdue_amount_pkr: number
  outstanding_amount_pkr: number
  collected_amount_pkr: number
  top_fabrics: { title: string; slug: string; inquiries: number }[]
  top_suppliers: { brand_name: string; inquiries: number }[]
  funnel: {
    product_views: number
    unique_view_sessions: number
    inquiries: number
    sample_requests: number
    supplier_responses: number
    /** Outbound notifications sent, NOT click-throughs — see the migration note. */
    whatsapp_notifications_sent: number
  }
  buyer_conversion: { buyers_total: number; buyers_with_inquiry: number }
  pending_price_approvals: number
}

export interface PhoneNumber {
  label: string
  number: string
}

export interface WhatsappNumber {
  label: string
  number: string
  primary?: boolean
}

export interface NotificationChannelSettings {
  email: boolean
  whatsapp: boolean
  in_app: boolean
}

export interface SupplierNotificationSettings {
  inquiry_received: NotificationChannelSettings
  message_received: NotificationChannelSettings
}

export interface ColorSamplePoint {
  image_index: number
  x: number
  y: number
}

export interface ListingFabricDetails {
  category_id?: string
  color_name?: string
  rough_specs?: Record<string, Json>
  notes?: string
}

export interface MessageAttachment {
  name: string
  /** Storage object key within the private message-attachments bucket. Rendered
   *  via a short-lived signed URL, never a public URL. */
  path: string
  size: number
  type: string
}

export interface InvoiceLineItem {
  product_id: string
  title: string
  qty: number
  unit_price_pkr: number
  unit_price_usd: number
  total_pkr?: number
  total_usd?: number
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: UserRole
          full_name: string | null
          company_name: string | null
          avatar_url: string | null
          phone_numbers: PhoneNumber[]
          whatsapp_numbers: WhatsappNumber[]
          status: ProfileStatus
          overdue_flagged: boolean
          overdue_flagged_at: string | null
          created_at: string
        }
        Insert: {
          id: string
          role: UserRole
          full_name?: string | null
          company_name?: string | null
          avatar_url?: string | null
          phone_numbers?: PhoneNumber[]
          whatsapp_numbers?: WhatsappNumber[]
          status?: ProfileStatus
          created_at?: string
        }
        Update: {
          id?: string
          role?: UserRole
          full_name?: string | null
          company_name?: string | null
          avatar_url?: string | null
          phone_numbers?: PhoneNumber[]
          whatsapp_numbers?: WhatsappNumber[]
          status?: ProfileStatus
          overdue_flagged?: boolean
          overdue_flagged_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          id: string
          brand_name: string
          slug: string
          website_url: string | null
          instagram_url: string | null
          is_verified: boolean
          badge_label: string | null
          notification_settings: SupplierNotificationSettings
          created_at: string
        }
        Insert: {
          id: string
          brand_name: string
          slug: string
          website_url?: string | null
          instagram_url?: string | null
          is_verified?: boolean
          badge_label?: string | null
          notification_settings?: SupplierNotificationSettings
          created_at?: string
        }
        Update: {
          id?: string
          brand_name?: string
          slug?: string
          website_url?: string | null
          instagram_url?: string | null
          is_verified?: boolean
          badge_label?: string | null
          notification_settings?: SupplierNotificationSettings
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'suppliers_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      buyers: {
        Row: {
          id: string
          email_domain: string | null
          created_at: string
        }
        Insert: {
          id: string
          email_domain?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email_domain?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'buyers_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      fabric_categories: {
        Row: {
          id: string
          name: string
          slug: string
          parent_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          parent_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          parent_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'fabric_categories_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'fabric_categories'
            referencedColumns: ['id']
          },
        ]
      }
      fabric_attributes: {
        Row: {
          id: string
          category_id: string | null
          name: string
          slug: string
          type: FabricAttributeType
          unit: string | null
          options: Json | null
          is_required: boolean
          is_filterable: boolean
          display_order: number
          created_at: string
        }
        Insert: {
          id?: string
          category_id?: string | null
          name: string
          slug: string
          type: FabricAttributeType
          unit?: string | null
          options?: Json | null
          is_required?: boolean
          is_filterable?: boolean
          display_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          category_id?: string | null
          name?: string
          slug?: string
          type?: FabricAttributeType
          unit?: string | null
          options?: Json | null
          is_required?: boolean
          is_filterable?: boolean
          display_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'fabric_attributes_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'fabric_categories'
            referencedColumns: ['id']
          },
        ]
      }
      color_families: {
        Row: {
          id: string
          slug: string
          name: string
          display_order: number
        }
        Insert: {
          id?: string
          slug: string
          name: string
          display_order?: number
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          display_order?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          supplier_id: string
          category_id: string | null
          title: string
          slug: string
          description: string | null
          status: ProductStatus
          visibility: ProductVisibility
          price_min_pkr: number | null
          price_max_pkr: number | null
          price_min_usd: number | null
          price_max_usd: number | null
          price_approved: boolean
          price_approved_by: string | null
          price_approved_at: string | null
          stock_meters: number
          moq_meters: number | null
          lead_time_days: number | null
          gsm: number | null
          width_inches: number | null
          composition: string | null
          sample_available: boolean
          video_url: string | null
          images: string[]
          scan_files: string[]
          color_supplier_name: string | null
          color_display_name: string | null
          color_hex: string | null
          color_rgb: [number, number, number] | null
          color_family: string | null
          color_sample: ColorSamplePoint | null
          /** Colourway family. Null for standalone fabrics — the vast majority. */
          fabric_group_id: string | null
          test_report_status: TestReportStatus | null
          is_featured: boolean
          view_count: number
          inquiry_count: number
          created_by: string | null
          published_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          supplier_id: string
          category_id?: string | null
          title: string
          slug: string
          description?: string | null
          status?: ProductStatus
          visibility?: ProductVisibility
          price_min_pkr?: number | null
          price_max_pkr?: number | null
          price_min_usd?: number | null
          price_max_usd?: number | null
          price_approved?: boolean
          price_approved_by?: string | null
          price_approved_at?: string | null
          stock_meters?: number
          moq_meters?: number | null
          lead_time_days?: number | null
          gsm?: number | null
          width_inches?: number | null
          composition?: string | null
          sample_available?: boolean
          video_url?: string | null
          images?: string[]
          scan_files?: string[]
          color_supplier_name?: string | null
          color_display_name?: string | null
          color_hex?: string | null
          color_rgb?: [number, number, number] | null
          color_family?: string | null
          color_sample?: ColorSamplePoint | null
          fabric_group_id?: string | null
          test_report_status?: TestReportStatus | null
          is_featured?: boolean
          view_count?: number
          inquiry_count?: number
          created_by?: string | null
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          supplier_id?: string
          category_id?: string | null
          title?: string
          slug?: string
          description?: string | null
          status?: ProductStatus
          visibility?: ProductVisibility
          price_min_pkr?: number | null
          price_max_pkr?: number | null
          price_min_usd?: number | null
          price_max_usd?: number | null
          price_approved?: boolean
          price_approved_by?: string | null
          price_approved_at?: string | null
          stock_meters?: number
          moq_meters?: number | null
          lead_time_days?: number | null
          gsm?: number | null
          width_inches?: number | null
          composition?: string | null
          sample_available?: boolean
          video_url?: string | null
          images?: string[]
          scan_files?: string[]
          color_supplier_name?: string | null
          color_display_name?: string | null
          color_hex?: string | null
          color_rgb?: [number, number, number] | null
          color_family?: string | null
          color_sample?: ColorSamplePoint | null
          fabric_group_id?: string | null
          test_report_status?: TestReportStatus | null
          is_featured?: boolean
          view_count?: number
          inquiry_count?: number
          created_by?: string | null
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'products_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'suppliers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'fabric_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_color_family_fkey'
            columns: ['color_family']
            isOneToOne: false
            referencedRelation: 'color_families'
            referencedColumns: ['slug']
          },
          {
            foreignKeyName: 'products_price_approved_by_fkey'
            columns: ['price_approved_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      product_attributes: {
        Row: {
          id: string
          product_id: string
          attribute_id: string
          value_text: string | null
          value_number: number | null
          value_json: Json | null
        }
        Insert: {
          id?: string
          product_id: string
          attribute_id: string
          value_text?: string | null
          value_number?: number | null
          value_json?: Json | null
        }
        Update: {
          id?: string
          product_id?: string
          attribute_id?: string
          value_text?: string | null
          value_number?: number | null
          value_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: 'product_attributes_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_attributes_attribute_id_fkey'
            columns: ['attribute_id']
            isOneToOne: false
            referencedRelation: 'fabric_attributes'
            referencedColumns: ['id']
          },
        ]
      }
      product_private_domains: {
        Row: {
          id: string
          product_id: string
          domain: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          domain: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          domain?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'product_private_domains_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_private_domains_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      listing_requests: {
        Row: {
          id: string
          supplier_id: string
          product_id: string | null
          status: ListingRequestStatus
          supplier_notes: string | null
          fabric_details: ListingFabricDetails | null
          admin_notes: string | null
          rejection_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          supplier_id: string
          product_id?: string | null
          status?: ListingRequestStatus
          supplier_notes?: string | null
          fabric_details?: ListingFabricDetails | null
          admin_notes?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          supplier_id?: string
          product_id?: string | null
          status?: ListingRequestStatus
          supplier_notes?: string | null
          fabric_details?: ListingFabricDetails | null
          admin_notes?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'listing_requests_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'suppliers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'listing_requests_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      inquiries: {
        Row: {
          id: string
          buyer_id: string
          supplier_id: string
          status: InquiryStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          buyer_id: string
          supplier_id: string
          status?: InquiryStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          buyer_id?: string
          supplier_id?: string
          status?: InquiryStatus
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'inquiries_buyer_id_fkey'
            columns: ['buyer_id']
            isOneToOne: false
            referencedRelation: 'buyers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'inquiries_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'suppliers'
            referencedColumns: ['id']
          },
        ]
      }
      inquiry_status_events: {
        Row: {
          id: string
          inquiry_id: string
          from_status: InquiryStatus | null
          to_status: InquiryStatus
          /** null for pre-trigger backfilled rows and service-role changes */
          actor_id: string | null
          created_at: string
        }
        // Written only by the log_inquiry_status_event trigger. There is no
        // INSERT/UPDATE/DELETE policy, so client writes always fail.
        Insert: never
        Update: never
        Relationships: [
          {
            foreignKeyName: 'inquiry_status_events_inquiry_id_fkey'
            columns: ['inquiry_id']
            isOneToOne: false
            referencedRelation: 'inquiries'
            referencedColumns: ['id']
          },
        ]
      }
      inquiry_items: {
        Row: {
          id: string
          inquiry_id: string
          product_id: string
          quantity_meters: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          inquiry_id: string
          product_id: string
          quantity_meters?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          inquiry_id?: string
          product_id?: string
          quantity_meters?: number | null
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'inquiry_items_inquiry_id_fkey'
            columns: ['inquiry_id']
            isOneToOne: false
            referencedRelation: 'inquiries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'inquiry_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      support_messages: {
        Row: {
          id: string
          user_id: string
          sender_id: string
          content: string
          attachments: MessageAttachment[]
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          sender_id: string
          content: string
          attachments?: MessageAttachment[]
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          sender_id?: string
          content?: string
          attachments?: MessageAttachment[]
          read_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          id: string
          actor_id: string | null
          action: string
          target_id: string | null
          target_type: string | null
          detail: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          actor_id?: string | null
          action: string
          target_id?: string | null
          target_type?: string | null
          detail?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          actor_id?: string | null
          action?: string
          target_id?: string | null
          target_type?: string | null
          detail?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      messages: {
        // A message hangs off EXACTLY ONE of inquiry_id / sample_request_id --
        // enforced by the messages_exactly_one_thread CHECK constraint.
        Row: {
          id: string
          inquiry_id: string | null
          sample_request_id: string | null
          sender_id: string
          content: string | null
          attachments: MessageAttachment[]
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          inquiry_id?: string | null
          sample_request_id?: string | null
          sender_id: string
          content?: string | null
          attachments?: MessageAttachment[]
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          inquiry_id?: string | null
          sample_request_id?: string | null
          sender_id?: string
          content?: string | null
          attachments?: MessageAttachment[]
          read_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'messages_inquiry_id_fkey'
            columns: ['inquiry_id']
            isOneToOne: false
            referencedRelation: 'inquiries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'messages_sample_request_id_fkey'
            columns: ['sample_request_id']
            isOneToOne: false
            referencedRelation: 'sample_requests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'messages_sender_id_fkey'
            columns: ['sender_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      shipping_addresses: {
        Row: {
          id: string
          buyer_id: string
          label: string | null
          recipient_name: string
          phone: string | null
          line1: string
          line2: string | null
          city: string
          province: string | null
          postal_code: string | null
          country: string
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          buyer_id: string
          label?: string | null
          recipient_name: string
          phone?: string | null
          line1: string
          line2?: string | null
          city: string
          province?: string | null
          postal_code?: string | null
          country?: string
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          buyer_id?: string
          label?: string | null
          recipient_name?: string
          phone?: string | null
          line1?: string
          line2?: string | null
          city?: string
          province?: string | null
          postal_code?: string | null
          country?: string
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'shipping_addresses_buyer_id_fkey'
            columns: ['buyer_id']
            isOneToOne: false
            referencedRelation: 'buyers'
            referencedColumns: ['id']
          },
        ]
      }
      sample_requests: {
        Row: {
          id: string
          buyer_id: string
          supplier_id: string
          status: SampleRequestStatus
          /** Snapshot of the address at request time -- NOT a live FK. */
          ship_to: ShipToSnapshot
          courier: string | null
          tracking_number: string | null
          buyer_notes: string | null
          supplier_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          buyer_id: string
          supplier_id: string
          status?: SampleRequestStatus
          ship_to: ShipToSnapshot
          courier?: string | null
          tracking_number?: string | null
          buyer_notes?: string | null
          supplier_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          status?: SampleRequestStatus
          courier?: string | null
          tracking_number?: string | null
          buyer_notes?: string | null
          supplier_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sample_requests_buyer_id_fkey'
            columns: ['buyer_id']
            isOneToOne: false
            referencedRelation: 'buyers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sample_requests_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'suppliers'
            referencedColumns: ['id']
          },
        ]
      }
      sample_request_items: {
        Row: {
          id: string
          sample_request_id: string
          product_id: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          sample_request_id: string
          product_id: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'sample_request_items_sample_request_id_fkey'
            columns: ['sample_request_id']
            isOneToOne: false
            referencedRelation: 'sample_requests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sample_request_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      cart_items: {
        Row: {
          id: string
          buyer_id: string
          product_id: string
          quantity_meters: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          buyer_id: string
          product_id: string
          quantity_meters?: number
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          buyer_id?: string
          product_id?: string
          quantity_meters?: number
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'cart_items_buyer_id_fkey'
            columns: ['buyer_id']
            isOneToOne: false
            referencedRelation: 'buyers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cart_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      wishlist_items: {
        Row: {
          id: string
          buyer_id: string
          product_id: string
          created_at: string
        }
        Insert: {
          id?: string
          buyer_id: string
          product_id: string
          created_at?: string
        }
        Update: {
          id?: string
          buyer_id?: string
          product_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'wishlist_items_buyer_id_fkey'
            columns: ['buyer_id']
            isOneToOne: false
            referencedRelation: 'buyers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'wishlist_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      catalogues: {
        Row: {
          id: string
          supplier_id: string
          name: string
          share_token: string
          is_active: boolean
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          supplier_id: string
          name: string
          share_token?: string
          is_active?: boolean
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          supplier_id?: string
          name?: string
          share_token?: string
          is_active?: boolean
          expires_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'catalogues_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'suppliers'
            referencedColumns: ['id']
          },
        ]
      }
      catalogue_products: {
        Row: {
          catalogue_id: string
          product_id: string
        }
        Insert: {
          catalogue_id: string
          product_id: string
        }
        Update: {
          catalogue_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'catalogue_products_catalogue_id_fkey'
            columns: ['catalogue_id']
            isOneToOne: false
            referencedRelation: 'catalogues'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'catalogue_products_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      fabric_groups: {
        Row: {
          id: string
          supplier_id: string
          title: string
          slug: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          supplier_id: string
          title: string
          slug: string
          created_by?: string | null
        }
        Update: {
          title?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: 'fabric_groups_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'suppliers'
            referencedColumns: ['id']
          },
        ]
      }
      payments: {
        Row: {
          id: string
          invoice_id: string
          /** Derived from the invoice by set_payment_parties — never client-supplied. */
          buyer_id: string
          supplier_id: string
          amount_pkr: number
          paid_on: string
          method: string | null
          reference: string | null
          provider: string | null
          provider_payment_id: string | null
          provider_status: string | null
          raw: Json | null
          recorded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          amount_pkr: number
          paid_on?: string
          method?: string | null
          reference?: string | null
          // buyer_id/supplier_id/recorded_by are filled by the trigger.
          buyer_id?: string
          supplier_id?: string
          recorded_by?: string | null
        }
        Update: {
          amount_pkr?: number
          paid_on?: string
          method?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'payments_invoice_id_fkey'
            columns: ['invoice_id']
            isOneToOne: false
            referencedRelation: 'invoices'
            referencedColumns: ['id']
          },
        ]
      }
      invoices: {
        Row: {
          id: string
          inquiry_id: string
          supplier_id: string
          buyer_id: string
          line_items: InvoiceLineItem[]
          subtotal_pkr: number | null
          subtotal_usd: number | null
          notes: string | null
          status: InvoiceStatus
          pdf_url: string | null
          created_at: string
          sent_at: string | null
          /** Stamped on send (sent_at + 30 days). Null while draft. */
          due_date: string | null
          /** DERIVED by the payments trigger — never write from a client. */
          amount_paid_pkr: number
          /** DERIVED by the payments trigger — never write from a client. */
          payment_status: PaymentStatus
        }
        Insert: {
          id?: string
          inquiry_id: string
          supplier_id: string
          buyer_id: string
          line_items: InvoiceLineItem[]
          subtotal_pkr?: number | null
          subtotal_usd?: number | null
          notes?: string | null
          status?: InvoiceStatus
          pdf_url?: string | null
          created_at?: string
          sent_at?: string | null
        }
        // due_date / amount_paid_pkr / payment_status are intentionally absent:
        // the guard trigger rejects non-admin writes and the payments trigger owns
        // the derived pair. Keeping them out makes that a compile error.
        Update: {
          id?: string
          line_items?: InvoiceLineItem[]
          subtotal_pkr?: number | null
          subtotal_usd?: number | null
          notes?: string | null
          status?: InvoiceStatus
          pdf_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'invoices_inquiry_id_fkey'
            columns: ['inquiry_id']
            isOneToOne: false
            referencedRelation: 'inquiries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'suppliers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_buyer_id_fkey'
            columns: ['buyer_id']
            isOneToOne: false
            referencedRelation: 'buyers'
            referencedColumns: ['id']
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          body: string | null
          data: Json | null
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          body?: string | null
          data?: Json | null
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          body?: string | null
          data?: Json | null
          read_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      recent_views: {
        Row: {
          id: string
          user_id: string | null
          session_id: string | null
          product_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          session_id?: string | null
          product_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          session_id?: string | null
          product_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'recent_views_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'recent_views_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      page_presence: {
        Row: {
          id: string
          user_id: string | null
          session_id: string | null
          page_path: string
          user_agent: string | null
          last_seen: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          session_id?: string | null
          page_path: string
          user_agent?: string | null
          last_seen?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          session_id?: string | null
          page_path?: string
          user_agent?: string | null
          last_seen?: string
        }
        Relationships: [
          {
            foreignKeyName: 'page_presence_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      supplier_page_views: {
        Row: {
          id: string
          supplier_id: string
          product_id: string | null
          viewer_id: string | null
          session_id: string | null
          referrer: string | null
          viewed_at: string
        }
        Insert: {
          id?: string
          supplier_id: string
          product_id?: string | null
          viewer_id?: string | null
          session_id?: string | null
          referrer?: string | null
          viewed_at?: string
        }
        Update: {
          id?: string
          supplier_id?: string
          product_id?: string | null
          viewer_id?: string | null
          session_id?: string | null
          referrer?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'supplier_page_views_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'suppliers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'supplier_page_views_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'supplier_page_views_viewer_id_fkey'
            columns: ['viewer_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      whatsapp_log: {
        Row: {
          id: string
          user_id: string | null
          phone_number: string
          template: string
          variables: Json | null
          status: string | null
          wa_message_id: string | null
          sent_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          phone_number: string
          template: string
          variables?: Json | null
          status?: string | null
          wa_message_id?: string | null
          sent_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          phone_number?: string
          template?: string
          variables?: Json | null
          status?: string | null
          wa_message_id?: string | null
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'whatsapp_log_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      fx_rates: {
        Row: {
          id: string
          base: string
          target: string
          rate: number
          fetched_at: string
        }
        Insert: {
          id?: string
          base?: string
          target?: string
          rate: number
          fetched_at?: string
        }
        Update: {
          id?: string
          base?: string
          target?: string
          rate?: number
          fetched_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      get_supplier_visitor_stats: {
        Args: { supplier_uuid: string; since?: string }
        Returns: {
          viewer_id: string
          company_name: string | null
          full_name: string | null
          viewer_role: string | null
          visit_count: number
          product_views: number
          last_visit: string
        }[]
      }
      record_supplier_view: {
        Args: {
          p_supplier: string
          p_product?: string | null
          p_referrer?: string | null
          p_session?: string | null
        }
        Returns: undefined
      }
      get_supplier_response_stats: {
        Args: { supplier_uuid: string; since?: string }
        Returns: {
          total_inquiries: number
          responded: number
          response_rate: number
          median_response_minutes: number
        }[]
      }
      get_catalogue: {
        Args: { p_token: string }
        Returns: Json
      }
      get_admin_report_stats: {
        Args: { p_weeks?: number }
        Returns: AdminReportStats
      }
      get_overdue_buyers: {
        Args: Record<string, never>
        Returns: {
          buyer_id: string
          full_name: string | null
          company_name: string | null
          overdue_flagged: boolean
          status: ProfileStatus
          overdue_invoices: number
          overdue_amount_pkr: number
          oldest_due_date: string | null
        }[]
      }
      get_counterparty_profiles: {
        Args: Record<string, never>
        Returns: { id: string; full_name: string | null; company_name: string | null }[]
      }
      create_inquiry: {
        Args: {
          p_supplier_id: string
          p_lines: { product_id: string; quantity_meters: number; notes: string | null }[]
          p_cart_item_ids?: string[] | null
        }
        /** the new inquiry id */
        Returns: string
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

export type Profile = Tables<'profiles'>
export type Supplier = Tables<'suppliers'>
export type Buyer = Tables<'buyers'>
export type FabricCategory = Tables<'fabric_categories'>
export type FabricAttribute = Tables<'fabric_attributes'>
export type ColorFamilyRow = Tables<'color_families'>
export type Product = Tables<'products'>
export type ProductAttribute = Tables<'product_attributes'>
export type ProductPrivateDomain = Tables<'product_private_domains'>
export type ListingRequest = Tables<'listing_requests'>
export type Inquiry = Tables<'inquiries'>
export type InquiryItem = Tables<'inquiry_items'>
export type InquiryStatusEvent = Tables<'inquiry_status_events'>
export type ShippingAddress = Tables<'shipping_addresses'>
export type SampleRequest = Tables<'sample_requests'>
export type SampleRequestItem = Tables<'sample_request_items'>
export type Message = Tables<'messages'>
export type SupportMessage = Tables<'support_messages'>
export type AdminAuditLog = Tables<'admin_audit_log'>
export type CartItem = Tables<'cart_items'>
export type Invoice = Tables<'invoices'>
export type Payment = Tables<'payments'>
export type Notification = Tables<'notifications'>
export type RecentView = Tables<'recent_views'>
export type PagePresence = Tables<'page_presence'>
export type SupplierPageView = Tables<'supplier_page_views'>
export type WhatsappLog = Tables<'whatsapp_log'>
export type FxRate = Tables<'fx_rates'>
