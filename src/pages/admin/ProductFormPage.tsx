import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Pipette, Upload, X } from 'lucide-react'
import { ColorSampler } from '@/components/color/ColorSampler'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { getProductImageUrl } from '@/lib/utils'
import { generateClientImageVariants } from '@/lib/client-image-variants'
import { useAuth } from '@/contexts/AuthContext'
import type { ColorSamplerValue } from '@/types/app'
import type {
  FabricAttribute,
  FabricCategory,
  Json,
  ProductAttribute,
} from '@/types/database.types'
import { AdminPageHeader } from './components/AdminPageHeader'

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

type AttributeValues = Record<string, string | number | boolean | string[]>

interface SupplierOption {
  id: string
  brand_name: string
}

export default function ProductFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [categories, setCategories] = useState<FabricCategory[]>([])
  const [attributes, setAttributes] = useState<FabricAttribute[]>([])

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [stockMeters, setStockMeters] = useState('')
  const [moqMeters, setMoqMeters] = useState('')
  const [priceMinPkr, setPriceMinPkr] = useState('')
  const [priceMaxPkr, setPriceMaxPkr] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [videoUrl, setVideoUrl] = useState('')
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [attributeValues, setAttributeValues] = useState<AttributeValues>({})
  const [color, setColor] = useState<ColorSamplerValue>({
    color_supplier_name: null,
    color_display_name: null,
    color_hex: null,
    color_rgb: null,
    color_family: null,
    color_sample: null,
  })

  const [colorSamplerOpen, setColorSamplerOpen] = useState(false)
  const [samplerImageIndex, setSamplerImageIndex] = useState(0)

  const hasColor = Boolean(color.color_hex)

  const loadAttributes = useCallback(async (catId: string) => {
    const { data } = await supabase
      .from('fabric_attributes')
      .select('*')
      .or(`category_id.eq.${catId},category_id.is.null`)
      .order('display_order')

    setAttributes(data ?? [])
  }, [])

  useEffect(() => {
    async function loadMeta() {
      const [suppliersRes, categoriesRes] = await Promise.all([
        supabase.from('suppliers').select('id, brand_name').order('brand_name'),
        supabase.from('fabric_categories').select('*').order('name'),
      ])
      setSuppliers(suppliersRes.data ?? [])
      setCategories(categoriesRes.data ?? [])
    }
    loadMeta()
  }, [])

  useEffect(() => {
    if (categoryId) loadAttributes(categoryId)
    else setAttributes([])
  }, [categoryId, loadAttributes])

  useEffect(() => {
    if (!isEdit || !id) return

    const productId = id

    async function loadProduct() {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*, attributes:product_attributes(*)')
        .eq('id', productId)
        .maybeSingle()

      if (fetchError || !data) {
        setError(fetchError?.message ?? 'Product not found')
        setLoading(false)
        return
      }

      setTitle(data.title)
      setSlug(data.slug)
      setDescription(data.description ?? '')
      setSupplierId(data.supplier_id)
      setCategoryId(data.category_id ?? '')
      setStockMeters(String(data.stock_meters))
      setMoqMeters(data.moq_meters != null ? String(data.moq_meters) : '')
      setPriceMinPkr(data.price_min_pkr != null ? String(data.price_min_pkr) : '')
      setPriceMaxPkr(data.price_max_pkr != null ? String(data.price_max_pkr) : '')
      setImages(data.images ?? [])
      setVideoUrl(data.video_url ?? '')
      setColor({
        color_supplier_name: data.color_supplier_name,
        color_display_name: data.color_display_name,
        color_hex: data.color_hex,
        color_rgb: data.color_rgb,
        color_family: data.color_family as ColorSamplerValue['color_family'],
        color_sample: data.color_sample,
      })

      const values: AttributeValues = {}
      for (const attr of (data.attributes ?? []) as ProductAttribute[]) {
        if (attr.value_text != null) values[attr.attribute_id] = attr.value_text
        else if (attr.value_number != null) values[attr.attribute_id] = attr.value_number
        else if (attr.value_json != null) values[attr.attribute_id] = attr.value_json as string[]
      }
      setAttributeValues(values)
      setLoading(false)
    }

    loadProduct()
  }, [id, isEdit])

  function handleTitleChange(value: string) {
    setTitle(value)
    if (!isEdit) setSlug(slugify(value))
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files
    if (!files?.length) return

    setUploading(true)
    setError(null)

    try {
      const uploaded: string[] = []
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop() ?? 'jpg'
        const path = `${slug || id || 'new'}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(path, file)

        if (uploadError) throw uploadError

        const variants = await generateClientImageVariants(file, path)
        for (const variant of variants) {
          const { error: variantError } = await supabase.storage
            .from('product-images')
            .upload(variant.path, variant.blob, {
              contentType: 'image/webp',
              upsert: true,
            })

          if (variantError) throw variantError
        }

        uploaded.push(path)
      }
      setImages((prev) => [...prev, ...uploaded])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleVideoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingVideo(true)
    setError(null)
    try {
      const ext = file.name.split('.').pop() ?? 'mp4'
      const path = `${slug || id || 'new'}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('product-videos')
        .upload(path, file, { contentType: file.type, upsert: true })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('product-videos').getPublicUrl(path)
      setVideoUrl(data.publicUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Video upload failed')
    } finally {
      setUploadingVideo(false)
      event.target.value = ''
    }
  }

  function setAttributeValue(attrId: string, value: string | number | boolean | string[]) {
    setAttributeValues((prev) => ({ ...prev, [attrId]: value }))
  }

  function renderAttributeField(attr: FabricAttribute) {
    const value = attributeValues[attr.id]

    switch (attr.type) {
      case 'number':
        return (
          <Input
            type="number"
            value={value != null ? String(value) : ''}
            onChange={(e) =>
              setAttributeValue(attr.id, e.target.value ? Number(e.target.value) : '')
            }
            className="border-border-cream bg-card text-text-dark"
          />
        )
      case 'boolean':
        return (
          <Select
            value={value === true ? 'true' : value === false ? 'false' : ''}
            onValueChange={(v) => setAttributeValue(attr.id, v === 'true')}
          >
            <SelectTrigger className="border-border-cream bg-card text-text-dark">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        )
      case 'select': {
        const options = (attr.options as string[] | null) ?? []
        return (
          <Select
            value={typeof value === 'string' ? value : ''}
            onValueChange={(v) => setAttributeValue(attr.id, v)}
          >
            <SelectTrigger className="border-border-cream bg-card text-text-dark">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      }
      default:
        return (
          <Input
            value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
            onChange={(e) => setAttributeValue(attr.id, e.target.value)}
            className="border-border-cream bg-card text-text-dark"
          />
        )
    }
  }

  async function saveAttributes(productId: string) {
    await supabase.from('product_attributes').delete().eq('product_id', productId)

    const rows = attributes
      .filter((attr) => attributeValues[attr.id] !== undefined && attributeValues[attr.id] !== '')
      .map((attr) => {
        const val = attributeValues[attr.id]
        const row: {
          product_id: string
          attribute_id: string
          value_text?: string | null
          value_number?: number | null
          value_json?: Json | null
        } = { product_id: productId, attribute_id: attr.id }

        if (attr.type === 'number' && typeof val === 'number') row.value_number = val
        else if (attr.type === 'multiselect' && Array.isArray(val)) row.value_json = val
        else row.value_text = String(val)

        return row
      })

    if (rows.length) {
      await supabase.from('product_attributes').insert(rows)
    }
  }

  async function handleSave(publish: boolean) {
    if (!title.trim() || !slug.trim() || !supplierId) {
      setError('Title, slug, and supplier are required.')
      return
    }

    if (publish && !hasColor) {
      setError('A sampled color is required before publishing.')
      return
    }

    setSaving(true)
    setError(null)

    const payload = {
      title: title.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      supplier_id: supplierId,
      category_id: categoryId || null,
      stock_meters: Number(stockMeters) || 0,
      moq_meters: moqMeters ? Number(moqMeters) : null,
      price_min_pkr: priceMinPkr ? Number(priceMinPkr) : null,
      price_max_pkr: priceMaxPkr ? Number(priceMaxPkr) : null,
      images,
      video_url: videoUrl || null,
      color_supplier_name: color.color_supplier_name,
      color_display_name: color.color_display_name,
      color_hex: color.color_hex,
      color_rgb: color.color_rgb,
      color_family: color.color_family,
      color_sample: color.color_sample,
      status: publish ? ('published' as const) : ('draft' as const),
      published_at: publish ? new Date().toISOString() : null,
      created_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    }

    try {
      if (isEdit && id) {
        const { error: updateError } = await supabase
          .from('products')
          .update(payload)
          .eq('id', id)

        if (updateError) throw updateError
        await saveAttributes(id)
        navigate('/admin/products')
      } else {
        const { data, error: insertError } = await supabase
          .from('products')
          .insert(payload)
          .select('id')
          .single()

        if (insertError) throw insertError
        await saveAttributes(data.id)
        navigate('/admin/products')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div>
        <AdminPageHeader title={isEdit ? 'Edit Product' : 'New Product'} />
        <Skeleton className="h-96 w-full bg-border-cream" />
      </div>
    )
  }

  const samplerImageUrl = images[samplerImageIndex]
    ? getProductImageUrl(images[samplerImageIndex])
    : ''

  return (
    <div>
      <AdminPageHeader
        title={isEdit ? 'Edit Product' : 'New Product'}
        description="Create or update a fabric listing with attributes and color sampling."
        actions={
          <Button variant="ghost" asChild>
            <Link to="/admin/products">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />

      {error && (
        <div className="mb-6 flex items-center gap-2 border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!hasColor && (
        <div className="mb-6 flex items-center gap-2 border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Sample a color from a product image before publishing.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Basic Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="border-border-cream bg-card text-text-dark"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="border-border-cream bg-card font-mono text-text-dark"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="border-border-cream bg-card text-text-dark"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Supplier</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger className="border-border-cream bg-card text-text-dark">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.brand_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger className="border-border-cream bg-card text-text-dark">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="stock">Stock (m)</Label>
                <Input
                  id="stock"
                  type="number"
                  value={stockMeters}
                  onChange={(e) => setStockMeters(e.target.value)}
                  className="border-border-cream bg-card text-text-dark"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="moq">MOQ (m)</Label>
                <Input
                  id="moq"
                  type="number"
                  value={moqMeters}
                  onChange={(e) => setMoqMeters(e.target.value)}
                  className="border-border-cream bg-card text-text-dark"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price-min">Price Min (PKR)</Label>
                <Input
                  id="price-min"
                  type="number"
                  value={priceMinPkr}
                  onChange={(e) => setPriceMinPkr(e.target.value)}
                  className="border-border-cream bg-card text-text-dark"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Images</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex cursor-pointer items-center justify-center gap-2 border border-dashed border-border-cream bg-surface/5 px-4 py-8 text-sm text-text-dark-secondary hover:border-accent">
                <Upload className="h-4 w-4" />
                {uploading ? 'Uploading…' : 'Upload images'}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={uploading}
                />
              </label>

              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {images.map((img, index) => (
                    <div key={img} className="group relative aspect-square overflow-hidden border border-border-cream">
                      <img
                        src={getProductImageUrl(img)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-white"
                          onClick={() => {
                            setSamplerImageIndex(index)
                            setColorSamplerOpen(true)
                          }}
                        >
                          <Pipette className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-white"
                          onClick={() => removeImage(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Video</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex cursor-pointer items-center justify-center gap-2 border border-dashed border-border-cream bg-surface/5 px-4 py-6 text-sm text-text-dark-secondary hover:border-accent">
                <Upload className="h-4 w-4" />
                {uploadingVideo ? 'Uploading…' : videoUrl ? 'Replace video' : 'Upload video'}
                <input
                  type="file"
                  accept="video/mp4,video/webm"
                  className="hidden"
                  onChange={handleVideoUpload}
                  disabled={uploadingVideo}
                />
              </label>
              <p className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                MP4 or WEBM — plays on the product page
              </p>

              {videoUrl && (
                <div className="relative overflow-hidden border border-border-cream">
                  <video src={videoUrl} controls className="aspect-video w-full bg-black object-cover" />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="absolute right-1 top-1 bg-black/50 text-white hover:bg-black/70"
                    onClick={() => setVideoUrl('')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Color</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasColor ? (
                <div className="flex items-center gap-4">
                  <span
                    className="h-12 w-12 border-2 border-border-cream"
                    style={{ backgroundColor: color.color_hex ?? undefined }}
                  />
                  <div>
                    <p className="font-medium text-text-dark">
                      {color.color_display_name ?? 'Sampled color'}
                    </p>
                    <p className="font-mono text-xs text-text-dark-secondary">
                      {color.color_hex} · {color.color_family}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!images.length}
                    onClick={() => setColorSamplerOpen(true)}
                  >
                    <Pipette className="h-4 w-4" />
                    Re-sample
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  disabled={!images.length}
                  onClick={() => setColorSamplerOpen(true)}
                >
                  <Pipette className="h-4 w-4" />
                  Sample Color
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {attributes.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Attributes (EAV)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {attributes.map((attr) => (
                <div key={attr.id} className="space-y-2">
                  <Label>
                    {attr.name}
                    {attr.unit && (
                      <span className="ml-1 text-text-dark-secondary">({attr.unit})</span>
                    )}
                    {attr.is_required && <span className="text-accent"> *</span>}
                  </Label>
                  {renderAttributeField(attr)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Button variant="outline" disabled={saving} onClick={() => handleSave(false)}>
          Save Draft
        </Button>
        <Button disabled={saving || !hasColor} onClick={() => handleSave(true)}>
          Publish
        </Button>
      </div>

      {samplerImageUrl && (
        <ColorSampler
          open={colorSamplerOpen}
          onOpenChange={setColorSamplerOpen}
          imageUrl={samplerImageUrl}
          imageIndex={samplerImageIndex}
          initialValue={color}
          onConfirm={setColor}
        />
      )}
    </div>
  )
}
