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
export type ListingRequestStatus =
  | 'submitted'
  | 'fabric_received'
  | 'scanning'
  | 'complete'
  | 'rejected'
export type InquiryStatus = 'open' | 'responded' | 'negotiating' | 'closed' | 'archived'
export type InvoiceStatus = 'draft' | 'sent' | 'acknowledged' | 'cancelled'

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
  url: string
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
          images: string[]
          scan_files: string[]
          color_supplier_name: string | null
          color_display_name: string | null
          color_hex: string | null
          color_rgb: [number, number, number] | null
          color_family: string | null
          color_sample: ColorSamplePoint | null
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
          images?: string[]
          scan_files?: string[]
          color_supplier_name?: string | null
          color_display_name?: string | null
          color_hex?: string | null
          color_rgb?: [number, number, number] | null
          color_family?: string | null
          color_sample?: ColorSamplePoint | null
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
          images?: string[]
          scan_files?: string[]
          color_supplier_name?: string | null
          color_display_name?: string | null
          color_hex?: string | null
          color_rgb?: [number, number, number] | null
          color_family?: string | null
          color_sample?: ColorSamplePoint | null
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
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          sender_id: string
          content: string
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          sender_id?: string
          content?: string
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
        Row: {
          id: string
          inquiry_id: string
          sender_id: string
          content: string | null
          attachments: MessageAttachment[]
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          inquiry_id: string
          sender_id: string
          content?: string | null
          attachments?: MessageAttachment[]
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          inquiry_id?: string
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
            foreignKeyName: 'messages_sender_id_fkey'
            columns: ['sender_id']
            isOneToOne: false
            referencedRelation: 'profiles'
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
        Update: {
          id?: string
          inquiry_id?: string
          supplier_id?: string
          buyer_id?: string
          line_items?: InvoiceLineItem[]
          subtotal_pkr?: number | null
          subtotal_usd?: number | null
          notes?: string | null
          status?: InvoiceStatus
          pdf_url?: string | null
          created_at?: string
          sent_at?: string | null
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
export type Message = Tables<'messages'>
export type SupportMessage = Tables<'support_messages'>
export type AdminAuditLog = Tables<'admin_audit_log'>
export type CartItem = Tables<'cart_items'>
export type Invoice = Tables<'invoices'>
export type Notification = Tables<'notifications'>
export type RecentView = Tables<'recent_views'>
export type PagePresence = Tables<'page_presence'>
export type SupplierPageView = Tables<'supplier_page_views'>
export type WhatsappLog = Tables<'whatsapp_log'>
export type FxRate = Tables<'fx_rates'>
