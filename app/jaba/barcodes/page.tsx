"use client"

import { useMemo, useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type SizeKey = "250" | "500" | "1000"
type FlavorKey = "DAWA" | "BERRY" | "HIBISCUS" | "PINEAPPLE" | "NEUTRAL"

type BarcodeItem = {
  id: string
  sizeKey: SizeKey
  sizeLabel: string
  flavorKey: FlavorKey
  flavorLabel: string
  code: string
}

const BARCODE_ITEMS: BarcodeItem[] = [
  // 250ml
  { sizeKey: "250", sizeLabel: "250ml", flavorKey: "DAWA",      flavorLabel: "Dawa",      code: "JB-250-DW",  id: "JB-250-DW" },
  { sizeKey: "250", sizeLabel: "250ml", flavorKey: "BERRY",     flavorLabel: "Berry",     code: "JB-250-BE",  id: "JB-250-BE" },
  { sizeKey: "250", sizeLabel: "250ml", flavorKey: "HIBISCUS",  flavorLabel: "Hibiscus",  code: "JB-250-HB",  id: "JB-250-HB" },
  { sizeKey: "250", sizeLabel: "250ml", flavorKey: "PINEAPPLE", flavorLabel: "Pineapple", code: "JB-250-PI",  id: "JB-250-PI" },
  { sizeKey: "250", sizeLabel: "250ml", flavorKey: "NEUTRAL",   flavorLabel: "Neutral",   code: "JB-250-NE",  id: "JB-250-NE" },
  // 500ml
  { sizeKey: "500", sizeLabel: "500ml", flavorKey: "DAWA",      flavorLabel: "Dawa",      code: "JB-500-DW",  id: "JB-500-DW" },
  { sizeKey: "500", sizeLabel: "500ml", flavorKey: "BERRY",     flavorLabel: "Berry",     code: "JB-500-BE",  id: "JB-500-BE" },
  { sizeKey: "500", sizeLabel: "500ml", flavorKey: "HIBISCUS",  flavorLabel: "Hibiscus",  code: "JB-500-HB",  id: "JB-500-HB" },
  { sizeKey: "500", sizeLabel: "500ml", flavorKey: "PINEAPPLE", flavorLabel: "Pineapple", code: "JB-500-PI",  id: "JB-500-PI" },
  { sizeKey: "500", sizeLabel: "500ml", flavorKey: "NEUTRAL",   flavorLabel: "Neutral",   code: "JB-500-NE",  id: "JB-500-NE" },
  // 1L
  { sizeKey: "1000", sizeLabel: "1 Liter", flavorKey: "DAWA",      flavorLabel: "Dawa",      code: "JB-1L-DW",  id: "JB-1L-DW" },
  { sizeKey: "1000", sizeLabel: "1 Liter", flavorKey: "BERRY",     flavorLabel: "Berry",     code: "JB-1L-BE",  id: "JB-1L-BE" },
  { sizeKey: "1000", sizeLabel: "1 Liter", flavorKey: "HIBISCUS",  flavorLabel: "Hibiscus",  code: "JB-1L-HB",  id: "JB-1L-HB" },
  { sizeKey: "1000", sizeLabel: "1 Liter", flavorKey: "PINEAPPLE", flavorLabel: "Pineapple", code: "JB-1L-PI",  id: "JB-1L-PI" },
  { sizeKey: "1000", sizeLabel: "1 Liter", flavorKey: "NEUTRAL",   flavorLabel: "Neutral",   code: "JB-1L-NE",  id: "JB-1L-NE" },
]

const SIZES: { key: SizeKey; label: string }[] = [
  { key: "250", label: "250ml" },
  { key: "500", label: "500ml" },
  { key: "1000", label: "1 Liter" },
]

const FLAVORS: { key: FlavorKey; label: string }[] = [
  { key: "DAWA", label: "Dawa" },
  { key: "BERRY", label: "Berry" },
  { key: "HIBISCUS", label: "Hibiscus" },
  { key: "PINEAPPLE", label: "Pineapple" },
  { key: "NEUTRAL", label: "Neutral" },
]

type SelectionMap = Record<string, boolean>

export default function JabaBarcodesPage() {
  const [selectedSizes, setSelectedSizes] = useState<SizeKey[]>(["250", "500", "1000"])
  const [selectedFlavors, setSelectedFlavors] = useState<FlavorKey[]>([
    "DAWA",
    "BERRY",
    "HIBISCUS",
    "PINEAPPLE",
    "NEUTRAL",
  ])
  const [selectedLabels, setSelectedLabels] = useState<SelectionMap>({})
  const [copiesPerLabel, setCopiesPerLabel] = useState<number>(1)

  const filteredItems = useMemo(
    () =>
      BARCODE_ITEMS.filter(
        (i) => selectedSizes.includes(i.sizeKey) && selectedFlavors.includes(i.flavorKey)
      ),
    [selectedSizes, selectedFlavors]
  )

  const anySelected = useMemo(
    () => Object.values(selectedLabels).some(Boolean),
    [selectedLabels]
  )

  const labelsToPrint = useMemo(() => {
    const base = anySelected
      ? filteredItems.filter((i) => selectedLabels[i.id])
      : filteredItems

    const out: BarcodeItem[] = []
    for (const item of base) {
      for (let i = 0; i < Math.max(1, copiesPerLabel); i++) {
        out.push(item)
      }
    }
    return out
  }, [filteredItems, selectedLabels, anySelected, copiesPerLabel])

  const handleToggleSize = (key: SizeKey, checked: boolean) => {
    setSelectedSizes((prev) =>
      checked ? Array.from(new Set([...prev, key])) : prev.filter((k) => k !== key)
    )
  }

  const handleToggleFlavor = (key: FlavorKey, checked: boolean) => {
    setSelectedFlavors((prev) =>
      checked ? Array.from(new Set([...prev, key])) : prev.filter((k) => k !== key)
    )
  }

  const handleToggleLabel = (id: string, checked: boolean) => {
    setSelectedLabels((prev) => ({ ...prev, [id]: checked }))
  }

  const selectAllVisible = () => {
    const entries: SelectionMap = {}
    filteredItems.forEach((i) => {
      entries[i.id] = true
    })
    setSelectedLabels(entries)
  }

  const clearSelection = () => {
    setSelectedLabels({})
  }

  const handlePrint = () => {
    // ensure we only print the dedicated sheet container
    window.print()
  }

  const handleCopiesChange = (value: string) => {
    const n = parseInt(value, 10)
    if (!Number.isNaN(n) && n > 0 && n <= 50) {
      setCopiesPerLabel(n)
    }
  }

  return (
    <>
      {/* Screen header */}
      <Header
        title="Jaba Barcode Labels"
        subtitle="Generate printer-ready sticker labels for Jaba products"
      />

      <div className="p-4 md:p-6 space-y-4 print:p-0">
        {/* Toolbar - screen only */}
        <Card className="border-border bg-card shadow-sm print:hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base md:text-lg">Print options</CardTitle>
            <CardDescription>
              Choose which labels to print and how many copies. The labels are optimized for
              sticker sheets and barcode scanners.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Sizes
                </p>
                <div className="flex flex-wrap gap-2">
                  {SIZES.map((s) => (
                    <label key={s.key} className="inline-flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedSizes.includes(s.key)}
                        onCheckedChange={(c) => handleToggleSize(s.key, c === true)}
                      />
                      <span>{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Flavors
                </p>
                <div className="flex flex-wrap gap-2">
                  {FLAVORS.map((f) => (
                    <label key={f.key} className="inline-flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedFlavors.includes(f.key)}
                        onCheckedChange={(c) => handleToggleFlavor(f.key, c === true)}
                      />
                      <span>{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Copies per label
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={copiesPerLabel}
                    onChange={(e) => handleCopiesChange(e.target.value)}
                    className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">per distinct product</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60 mt-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllVisible}
                  className="rounded-xl"
                >
                  Select visible
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                  className="rounded-xl"
                >
                  Clear selection
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={handlePrint}
                  className="rounded-xl"
                  disabled={labelsToPrint.length === 0}
                >
                  {anySelected ? "Print selected labels" : "Print all filtered labels"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Screen preview of labels */}
        <Card className="border-border bg-card shadow-sm print:hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base md:text-lg">Screen preview</CardTitle>
            <CardDescription>
              This preview approximates the sticker layout. For the real layout, use your
              browser&apos;s print preview.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No products match the selected size/flavor filters.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {filteredItems.map((item) => {
                  const checked = selectedLabels[item.id] ?? false
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "flex flex-col justify-between rounded-lg border px-3 py-2 bg-white",
                        checked && "ring-2 ring-primary border-primary"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                            Jaba
                          </p>
                          <p className="text-sm font-semibold text-foreground">{item.sizeLabel}</p>
                          <p className="text-sm text-foreground">{item.flavorLabel}</p>
                        </div>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => handleToggleLabel(item.id, c === true)}
                        />
                      </div>
                      <div className="mt-3 flex flex-col items-center">
                        {/* Use external bwip-js API for Code128 barcode rendering */}
                        <img
                          src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(
                            item.code
                          )}&scale=2&includetext&textxalign=center`}
                          alt={item.code}
                          className="max-w-full h-16 object-contain"
                        />
                        <p className="mt-1 text-xs font-mono tracking-wide text-foreground">
                          {item.code}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Printable sheet */}
        <div className="print:block hidden">
          <PrintableBarcodeSheet items={labelsToPrint} />
        </div>

        {/* Also render sheet in screen mode for debugging (but visually deemphasized) */}
        <div className="print:hidden">
          <Card className="border-dashed border-border bg-background/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Printable sheet (preview)</CardTitle>
              <CardDescription className="text-xs">
                This shows the exact layout used for printing. Use your browser&apos;s print preview
                to verify margins.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-white border border-border overflow-hidden">
                <PrintableBarcodeSheet items={labelsToPrint} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Print-specific CSS */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
          body {
            background: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </>
  )
}

function PrintableBarcodeSheet({ items }: { items: BarcodeItem[] }) {
  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        No labels selected. Use the toolbar to choose what to print.
      </div>
    )
  }

  return (
    <div
      className={cn(
        // A4-ish width container; in print it uses @page margins
        "p-2 grid gap-2",
        // 3 columns for typical sticker sheets; adjust with scale in printer if needed
        "grid-cols-2 md:grid-cols-3"
      )}
    >
      {items.map((item, idx) => (
        <div
          key={`${item.id}-${idx}`}
          className={cn(
            // Approx 65–75mm wide label, flexible height
            "border border-slate-300 rounded-sm bg-white text-black",
            "flex flex-col items-stretch justify-between px-2 py-1",
            "leading-tight"
          )}
          style={{
            // Avoid the browser shrinking too much; let user control scale via print dialog
            minHeight: "32mm",
          }}
        >
          <div className="text-center mb-1">
            <div className="text-[9px] font-semibold tracking-[0.18em] uppercase">
              Jaba
            </div>
            <div className="text-[9px] font-semibold">{item.sizeLabel}</div>
            <div className="text-[9px]">{item.flavorLabel}</div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <img
              src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(
                item.code
              )}&scale=2&includetext&textxalign=center&paddingwidth=8&paddingheight=4`}
              alt={item.code}
              className="w-full h-[18mm] object-contain"
            />
          </div>
          <div className="mt-1 text-center">
            <span className="text-[8px] font-mono tracking-wide">{item.code}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

