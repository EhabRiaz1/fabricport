import { useCallback, useEffect, useRef, useState } from 'react'
import { Pipette } from 'lucide-react'
import { cn } from '@/lib/utils'
import { COLOR_FAMILIES, classifyColorFamily } from '@/lib/color/classify'
import type { ColorFamily } from '@/lib/color/classify'
import { sampleCanvasColor } from '@/lib/color/sample'
import type { ColorSamplerValue } from '@/types/app'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface ColorSamplerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageUrl: string
  imageIndex?: number
  initialValue?: Partial<ColorSamplerValue>
  onConfirm: (value: ColorSamplerValue) => void
}

export function ColorSampler({
  open,
  onOpenChange,
  imageUrl,
  imageIndex = 0,
  initialValue,
  onConfirm,
}: ColorSamplerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const [sample, setSample] = useState<ColorSamplerValue>({
    color_supplier_name: initialValue?.color_supplier_name ?? null,
    color_display_name: initialValue?.color_display_name ?? null,
    color_hex: initialValue?.color_hex ?? null,
    color_rgb: initialValue?.color_rgb ?? null,
    color_family: initialValue?.color_family ?? null,
    color_sample: initialValue?.color_sample ?? null,
  })

  const drawImage = useCallback(() => {
    const canvas = canvasRef.current
    const image = imageRef.current
    if (!canvas || !image) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const maxWidth = 560
    const scale = Math.min(1, maxWidth / image.naturalWidth)
    canvas.width = image.naturalWidth * scale
    canvas.height = image.naturalHeight * scale

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!open || !imageUrl) return

    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      imageRef.current = image
      drawImage()
    }
    image.src = imageUrl

    return () => {
      imageRef.current = null
      setLoaded(false)
    }
  }, [open, imageUrl, drawImage])

  function handleCanvasClick(event: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (event.clientX - rect.left) * scaleX
    const y = (event.clientY - rect.top) * scaleY

    const result = sampleCanvasColor(canvas, x, y)
    const family = classifyColorFamily(result.rgb)

    setCursor({ x: event.clientX - rect.left, y: event.clientY - rect.top })
    setSample((prev) => ({
      ...prev,
      color_hex: result.hex,
      color_rgb: result.rgb,
      color_family: family,
      suggested_family: family,
      color_sample: {
        image_index: imageIndex,
        x: Math.round(x),
        y: Math.round(y),
      },
    }))
  }

  function handleConfirm() {
    onConfirm(sample)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pipette className="h-4 w-4 text-accent" />
            Sample Color
          </DialogTitle>
          <DialogDescription>
            Click anywhere on the fabric image to pick a color pixel.
          </DialogDescription>
        </DialogHeader>

        <div className="relative overflow-hidden border border-border bg-elevated">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className={cn(
              'mx-auto block max-w-full cursor-crosshair',
              !loaded && 'min-h-[200px]',
            )}
          />

          {cursor && sample.color_hex && (
            <span
              className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg"
              style={{
                left: cursor.x,
                top: cursor.y,
                backgroundColor: sample.color_hex,
              }}
            />
          )}

          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                Loading image...
              </p>
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="color-display-name">Display Name</Label>
            <Input
              id="color-display-name"
              value={sample.color_display_name ?? ''}
              onChange={(e) =>
                setSample((prev) => ({
                  ...prev,
                  color_display_name: e.target.value || null,
                }))
              }
              placeholder="e.g. Midnight Navy"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="color-supplier-name">Supplier Color Name</Label>
            <Input
              id="color-supplier-name"
              value={sample.color_supplier_name ?? ''}
              onChange={(e) =>
                setSample((prev) => ({
                  ...prev,
                  color_supplier_name: e.target.value || null,
                }))
              }
              placeholder="Supplier reference"
            />
          </div>

          <div className="space-y-2">
            <Label>Color Family</Label>
            <Select
              value={sample.color_family ?? undefined}
              onValueChange={(value) =>
                setSample((prev) => ({
                  ...prev,
                  color_family: value as ColorFamily,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select family" />
              </SelectTrigger>
              <SelectContent>
                {COLOR_FAMILIES.map((family) => (
                  <SelectItem key={family} value={family} className="capitalize">
                    {family}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Sampled Value</Label>
            <div className="flex h-10 items-center gap-3 border border-border bg-surface px-3">
              <span
                className="h-6 w-6 shrink-0 border border-border-cream"
                style={{ backgroundColor: sample.color_hex ?? '#000' }}
              />
              <span className="font-mono text-xs text-text-primary">
                {sample.color_hex ?? '—'}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!sample.color_hex}>
            Confirm Color
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ColorSampler
