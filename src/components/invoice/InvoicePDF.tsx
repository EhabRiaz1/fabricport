import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'
import type { InvoiceLineItem } from '@/types/database.types'

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
  notes?: string
  createdAt?: string
}

export function InvoicePDF({
  invoiceNumber,
  supplierName,
  buyerName,
  lineItems,
  subtotalPkr,
  subtotalUsd,
  notes,
  createdAt,
}: InvoicePDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>FabricPort Invoice</Text>
          <Text style={styles.subtitle}>#{invoiceNumber}</Text>
          {createdAt && (
            <Text style={styles.subtitle}>
              Date: {new Date(createdAt).toLocaleDateString()}
            </Text>
          )}
        </View>

        <View>
          <Text>From: {supplierName}</Text>
          <Text style={{ marginTop: 4 }}>To: {buyerName}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.headerRow}>
            <Text style={[styles.colTitle, styles.bold]}>Item</Text>
            <Text style={[styles.colQty, styles.bold]}>Qty (m)</Text>
            <Text style={[styles.colPrice, styles.bold]}>Unit PKR</Text>
            <Text style={[styles.colTotal, styles.bold]}>Total PKR</Text>
          </View>

          {lineItems.map((item, i) => (
            <View key={`${item.product_id}-${i}`} style={styles.row}>
              <Text style={styles.colTitle}>{item.title}</Text>
              <Text style={styles.colQty}>{item.qty}</Text>
              <Text style={styles.colPrice}>
                {item.unit_price_pkr.toLocaleString()}
              </Text>
              <Text style={styles.colTotal}>
                {(item.qty * item.unit_price_pkr).toLocaleString()}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <Text style={styles.bold}>
            Subtotal PKR: {subtotalPkr.toLocaleString()}
          </Text>
          <Text style={{ marginTop: 4 }}>
            Subtotal USD: ${subtotalUsd.toFixed(2)}
          </Text>
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
