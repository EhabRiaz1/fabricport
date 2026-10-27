import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'
import { formatPrice } from '@/lib/utils'
import type { InvoiceLineItem, InvoiceStatus, InvoiceTaxMode } from '@/types/database.types'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1A1A1A',
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#C8C4BC',
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#4A4A4A',
  },
  table: {
    marginTop: 16,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E4DC',
    paddingVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#1A1A1A',
    paddingBottom: 6,
    marginBottom: 4,
  },
  colTitle: { flex: 3 },
  colQty: { flex: 1, textAlign: 'right' },
  colPrice: { flex: 1.5, textAlign: 'right' },
  colTotal: { flex: 1.5, textAlign: 'right' },
  bold: { fontWeight: 'bold' },
  totals: {
    marginTop: 16,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 220,
    paddingVertical: 2,
  },
  grandTotalRow: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  notes: {
    marginTop: 24,
    padding: 12,
    backgroundColor: '#F0ECE4',
  },
})

export interface InvoicePDFProps {
  invoiceNumber: string
  supplierName: string
  buyerName: string
  lineItems: InvoiceLineItem[]
  subtotalPkr: number
  subtotalUsd: number
  taxMode?: InvoiceTaxMode
  taxRatePercent?: number
  taxPkr?: number
  freightPkr?: number
  /** Subtotal + tax + freight. Falls back to the subtotal when omitted. */
  totalPkr?: number
  paymentTerms?: string
  dueDate?: string
  notes?: string
  createdAt?: string
  status?: InvoiceStatus
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function InvoicePDF({
  invoiceNumber,
  supplierName,
  buyerName,
  lineItems,
  subtotalPkr,
  subtotalUsd,
  taxMode = 'total',
  taxRatePercent = 0,
  taxPkr = 0,
  freightPkr = 0,
  totalPkr,
  paymentTerms,
  dueDate,
  notes,
  createdAt,
  status,
}: InvoicePDFProps) {
  const perLine = taxMode === 'per_line'
  const grandTotal = totalPkr ?? subtotalPkr + taxPkr + freightPkr
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>
            FabricPort Invoice{status === 'draft' ? ' (draft)' : status === 'cancelled' ? ' (cancelled)' : ''}
          </Text>
          <Text style={styles.subtitle}>#{invoiceNumber}</Text>
          {createdAt && <Text style={styles.subtitle}>Date: {formatDate(createdAt)}</Text>}
          {dueDate && <Text style={styles.subtitle}>Due: {formatDate(dueDate)}</Text>}
          {paymentTerms && <Text style={styles.subtitle}>Payment terms: {paymentTerms}</Text>}
        </View>

        <View>
          <Text>From: {supplierName}</Text>
          <Text style={{ marginTop: 4 }}>To: {buyerName}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.headerRow}>
            <Text style={[styles.colTitle, styles.bold]}>Item</Text>
            <Text style={[styles.colQty, styles.bold]}>Qty (m)</Text>
            <Text style={[styles.colPrice, styles.bold]}>Unit price</Text>
            {perLine && <Text style={[styles.colQty, styles.bold]}>Tax %</Text>}
            <Text style={[styles.colTotal, styles.bold]}>Amount</Text>
          </View>

          {lineItems.map((item, i) => (
            <View key={`${item.product_id}-${i}`} style={styles.row}>
              <Text style={styles.colTitle}>{item.title}</Text>
              <Text style={styles.colQty}>{item.qty.toLocaleString('en-PK')}</Text>
              <Text style={styles.colPrice}>{formatPrice(item.unit_price_pkr, 'PKR')}</Text>
              {perLine && (
                <Text style={styles.colQty}>{item.tax_rate_percent ?? taxRatePercent}%</Text>
              )}
              <Text style={styles.colTotal}>
                {formatPrice(item.qty * item.unit_price_pkr, 'PKR')}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Subtotal</Text>
            <Text>{formatPrice(subtotalPkr, 'PKR')}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>{perLine ? 'Tax (per line)' : `Tax (${taxRatePercent}%)`}</Text>
            <Text>{formatPrice(taxPkr, 'PKR')}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Freight</Text>
            <Text>{formatPrice(freightPkr, 'PKR')}</Text>
          </View>
          <View style={[styles.totalRow, styles.grandTotalRow]}>
            <Text style={styles.bold}>Total</Text>
            <Text style={styles.bold}>{formatPrice(grandTotal, 'PKR')}</Text>
          </View>
          {subtotalUsd > 0 && (
            <Text style={[styles.subtitle, { marginTop: 4 }]}>
              Goods subtotal approx. {formatPrice(subtotalUsd, 'USD')}
            </Text>
          )}
        </View>

        {notes && (
          <View style={styles.notes}>
            <Text style={styles.bold}>Notes</Text>
            <Text style={{ marginTop: 4 }}>{notes}</Text>
          </View>
        )}
      </Page>
    </Document>
  )
}
