import { PDFViewer } from '@react-pdf/renderer'
import { InvoicePDF, type InvoicePDFProps } from '@/components/invoice/InvoicePDF'

export interface InvoicePreviewProps extends InvoicePDFProps {
  className?: string
}

export function InvoicePreview(props: InvoicePreviewProps) {
  const { className, ...pdfProps } = props

  return (
    <div className={className ?? 'h-[600px] w-full overflow-hidden border border-border-cream'}>
      <PDFViewer width="100%" height="100%" showToolbar={false}>
        <InvoicePDF {...pdfProps} />
      </PDFViewer>
    </div>
  )
}
