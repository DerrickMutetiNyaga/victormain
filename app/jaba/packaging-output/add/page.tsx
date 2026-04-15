"use client"

import { useState, useEffect, useMemo, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, X, Save, Printer, Warehouse, Package, Factory, Users, CheckCircle, TrendingUp, AlertCircle, Droplet, Loader2, Layers } from "lucide-react"
import Link from "next/link"
import { productionOutputs } from "@/lib/jaba-data"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { computePackagedLitresFromContainers } from "@/lib/jaba-packaging-calculations"
import { Checkbox } from "@/components/ui/checkbox"

interface ContainerRow {
  size: string
  quantity: string
  customSize?: string
}

type PackagingStockItem = {
  id: string
  name: string
  currentStock: number
  unit: string
  kind: string
}

type FlavourLinePackState = {
  included: boolean
  containers: ContainerRow[]
  volumeAllocated: string
  defects: string
  defectReasons: string
  machineEfficiency: string
}

const defaultContainerRows = (): ContainerRow[] => [
  { size: "250ml", quantity: "" },
  { size: "500ml", quantity: "" },
  { size: "1L", quantity: "" },
  { size: "2L", quantity: "" },
]

function CreatePackagingSessionPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [batchId, setBatchId] = useState("")
  const [volumeAllocated, setVolumeAllocated] = useState("")
  const [packagingDate, setPackagingDate] = useState(new Date().toISOString().split("T")[0])
  const [packageNumber, setPackageNumber] = useState("")
  const [supervisor, setSupervisor] = useState("")
  
  // Generate package number on client-side only (to avoid hydration mismatch)
  useEffect(() => {
    const currentYear = new Date().getFullYear()
    const randomNum = String(Math.floor(Math.random() * 99999)).padStart(5, "0")
    setPackageNumber(`PKG-${currentYear}-${randomNum}`)
  }, [])
  const [teamMembers, setTeamMembers] = useState<string[]>([])
  const [newMember, setNewMember] = useState("")
  const [containers, setContainers] = useState<ContainerRow[]>([
    { size: "250ml", quantity: "" },
    { size: "500ml", quantity: "" },
    { size: "1L", quantity: "" },
    { size: "2L", quantity: "" },
  ])
  const [defects, setDefects] = useState("")
  const [defectReasons, setDefectReasons] = useState("")
  const [machineEfficiency, setMachineEfficiency] = useState("")
  const [safetyChecks, setSafetyChecks] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [loadingBatch, setLoadingBatch] = useState(false)
  const [batchData, setBatchData] = useState<any>(null)
  const [availableBatches, setAvailableBatches] = useState<any[]>([])
  const [selectedFlavourLineId, setSelectedFlavourLineId] = useState("")
  const [packagingStock, setPackagingStock] = useState<{
    bottle: PackagingStockItem | null
    sticker: PackagingStockItem | null
    bySize: Record<
      '250ml' | '500ml' | '1L' | '2L',
      { bottle: PackagingStockItem | null; sticker: PackagingStockItem | null }
    >
  } | null>(null)
  const [packagingStockLoading, setPackagingStockLoading] = useState(true)
  const [packagingStockError, setPackagingStockError] = useState<string | null>(null)

  /** Multi-flavour session: one entry per flavour line id */
  const [lineStates, setLineStates] = useState<Record<string, FlavourLinePackState>>({})
  const [stockByFlavourLineId, setStockByFlavourLineId] = useState<
    Record<
      string,
      {
        bySize: Record<
          "250ml" | "500ml" | "1L" | "2L",
          { bottle: PackagingStockItem | null; sticker: PackagingStockItem | null }
        >
      } | null
    >
  >({})
  const [stockByLineLoading, setStockByLineLoading] = useState(false)
  const idempotencyKeyRef = useRef<string | null>(null)

  const getOrCreateIdempotencyKey = () => {
    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID()
    return idempotencyKeyRef.current
  }

  // Fetch available batches for selection
  useEffect(() => {
    fetchAvailableBatches()
  }, [])


  // Get batchId from URL params if available and fetch batch data
  useEffect(() => {
    idempotencyKeyRef.current = null
  }, [batchId])

  useEffect(() => {
    const batchIdParam = searchParams.get("batchId")
    if (batchIdParam) {
      setBatchId(batchIdParam)
      fetchBatchData(batchIdParam)
    }
  }, [searchParams])

  useEffect(() => {
    const fid = searchParams.get("flavourLineId")
    if (!fid || !batchData?.flavourOutputs?.length) return
    const lines = batchData.flavourOutputs.filter(
      (l: any) => Math.max(0, Number(l.remainingPackLitres) || 0) > 1e-6
    )
    if (!lines.some((l: any) => String(l._id || l.id) === fid)) return
    setSelectedFlavourLineId(fid)
    const line = lines.find((l: any) => String(l._id || l.id) === fid)
    if (line) {
      const cap = Math.max(0, Number(line.remainingPackLitres) || 0)
      setVolumeAllocated(cap > 0 ? String(cap) : String(Number(line.allocatedLitres) || 0))
    }
    setLineStates((prev) => {
      const base =
        prev[fid] ||
        ({
          included: false,
          containers: defaultContainerRows(),
          volumeAllocated: "0",
          defects: "",
          defectReasons: "",
          machineEfficiency: "",
        } satisfies FlavourLinePackState)
      const cap = Math.max(0, Number(line?.remainingPackLitres) || 0)
      return {
        ...prev,
        [fid]: {
          ...base,
          included: true,
          volumeAllocated:
            cap > 0 ? String(cap) : String(Number(line?.allocatedLitres) || 0),
        },
      }
    })
  }, [searchParams, batchData])

  const fetchAvailableBatches = async () => {
    try {
      const response = await fetch('/api/jaba/batches')
      const data = await response.json()
      
      if (response.ok && data.batches) {
        // Filter batches that are ready for packaging
        const readyBatches = data.batches.filter((b: any) => 
          b.status === "QC Passed - Ready for Packaging" ||
          b.status === "Ready for Packaging" ||
          b.status === "Processed" ||
          b.status === "Partially Packaged" ||
          b.status === "Partially Allocated" ||
          b.status === "Fully Allocated"
        )
        setAvailableBatches(readyBatches)
      }
    } catch (error) {
      console.error('Error fetching batches:', error)
    }
  }

  const fetchBatchData = async (id: string) => {
    try {
      setLoadingBatch(true)
      const response = await fetch(`/api/jaba/batches/${id}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch batch')
      }

      if (data.batch) {
        setBatchData(data.batch)
        setSupervisor(data.batch.supervisor || "")
        const allLines = data.batch.flavourOutputs || []
        const lines = allLines.filter(
          (l: any) => Math.max(0, Number(l.remainingPackLitres) || 0) > 1e-6
        )
        const nextLineStates: Record<string, FlavourLinePackState> = {}
        for (const l of lines) {
          const lid = String(l._id || l.id || "")
          if (!lid) continue
          const cap = Math.max(0, Number(l.remainingPackLitres) || 0)
          nextLineStates[lid] = {
            included: false,
            containers: defaultContainerRows(),
            volumeAllocated: cap > 0 ? String(cap) : String(Number(l.allocatedLitres) || 0),
            defects: "",
            defectReasons: "",
            machineEfficiency: "",
          }
        }
        setLineStates(nextLineStates)

        if (lines.length > 0) {
          const pick = lines[0]
          setSelectedFlavourLineId(String(pick._id || pick.id || ""))
          const cap = Math.max(0, Number(pick.remainingPackLitres) || 0)
          setVolumeAllocated(cap > 0 ? String(cap) : String(Number(pick.allocatedLitres) || 0))
        } else if (allLines.length > 0) {
          // Batch has flavour lines, but all are fully packaged.
          setSelectedFlavourLineId("")
          setVolumeAllocated("0")
        } else {
          setSelectedFlavourLineId("")
          const availableLitres =
            data.batch.outputSummary?.remainingLitres !== undefined &&
            data.batch.outputSummary.remainingLitres <= data.batch.totalLitres
              ? data.batch.outputSummary.remainingLitres
              : data.batch.totalLitres
          setVolumeAllocated(availableLitres?.toString() || "")
        }
        setPackagingDate(new Date().toISOString().split("T")[0])
      }
    } catch (error: any) {
      console.error('Error fetching batch:', error)
      toast.error(error.message || 'Failed to load batch data')
    } finally {
      setLoadingBatch(false)
    }
  }

  const selectedBatch = batchData || productionOutputs.find((b) => b.id === batchId)

  const addContainerRow = () => {
    setContainers([...containers, { size: "250ml", quantity: "" }])
  }

  const removeContainerRow = (index: number) => {
    setContainers(containers.filter((_, i) => i !== index))
  }

  const patchLineState = (lid: string, patch: Partial<FlavourLinePackState>) => {
    setLineStates((prev) => {
      const cur = prev[lid]
      if (!cur) return prev
      return { ...prev, [lid]: { ...cur, ...patch } }
    })
  }

  const updateLineContainer = (lid: string, index: number, field: keyof ContainerRow, value: string) => {
    setLineStates((prev) => {
      const st = prev[lid]
      if (!st) return prev
      const next = [...st.containers]
      next[index] = { ...next[index], [field]: value }
      return { ...prev, [lid]: { ...st, containers: next } }
    })
  }

  const addLineContainerRow = (lid: string) => {
    setLineStates((prev) => {
      const st = prev[lid]
      if (!st) return prev
      return { ...prev, [lid]: { ...st, containers: [...st.containers, { size: "250ml", quantity: "" }] } }
    })
  }

  const removeLineContainerRow = (lid: string, index: number) => {
    setLineStates((prev) => {
      const st = prev[lid]
      if (!st) return prev
      return { ...prev, [lid]: { ...st, containers: st.containers.filter((_, i) => i !== index) } }
    })
  }

  const handleSavePackaging = async () => {
    if (!batchId || !batchData) {
      toast.error("Please select a batch")
      return
    }

    if (!supervisor) {
      toast.error("Please enter packaging supervisor")
      return
    }

    if (teamMembers.length === 0) {
      toast.error("Please add at least one team member")
      return
    }

    if (!safetyChecks) {
      toast.error("Please complete safety checks before saving")
      return
    }

    const openLines = (batchData.flavourOutputs || []).filter(
      (l: any) => Math.max(0, Number(l.remainingPackLitres) || 0) > 1e-6
    )
    const stdSizes = ["250ml", "500ml", "1L", "2L"] as const

    if (openLines.length > 0) {
      const includedLines = openLines.filter((l: any) => lineStates[String(l._id || l.id)]?.included)
      if (includedLines.length === 0) {
        toast.error("Include at least one flavour line and enter quantities before saving.")
        return
      }
      for (const l of includedLines) {
        const lid = String(l._id || l.id)
        const st = lineStates[lid]
        if (!st) continue
        const lit = computePackagedLitresFromContainers(st.containers)
        const alloc = parseFloat(st.volumeAllocated) || 0
        if (lit <= 0) {
          toast.error(`Enter container quantities for ${l.flavourName || "flavour line"}.`)
          return
        }
        if (alloc <= 0) {
          toast.error(`Set volume allocated for ${l.flavourName || "flavour line"}.`)
          return
        }
        if (lit > alloc + 1e-6) {
          toast.error(
            `Packed litres (${lit.toFixed(2)}L) exceed allocated (${alloc.toFixed(2)}L) for ${l.flavourName || "line"}.`
          )
          return
        }
        const fname = String(l.flavourName || l.flavor || "").trim()
        const pack = stockByFlavourLineId[lid]
        for (const s of stdSizes) {
          let q = 0
          for (const c of st.containers) {
            if (c.size === s) q += Math.max(0, parseFloat(c.quantity) || 0)
          }
          if (q > 0 && fname && !pack?.bySize?.[s]?.sticker) {
            toast.error(
              `No flavour-specific sticker item for ${s} and "${fname}". Create it under Raw Materials → Packaging (Stickers) before packing.`
            )
            return
          }
        }
      }
      if (packagingStockInsufficient || stickerMissingForPackedSizes) {
        toast.error(
          "This session needs more bottles or stickers than are available in the warehouse. Reduce quantities or restock before saving."
        )
        return
      }

      const packagingLines = includedLines.map((l: any) => {
        const lid = String(l._id || l.id)
        const st = lineStates[lid]!
        const lit = computePackagedLitresFromContainers(st.containers)
        return {
          flavourLineId: lid,
          volumeAllocated: parseFloat(st.volumeAllocated) || 0,
          containers: st.containers,
          totalPackedLitres: lit,
          defects: st.defects,
          defectReasons: st.defectReasons,
          machineEfficiency: st.machineEfficiency,
        }
      })

      const totalLitres = packagingLines.reduce((s, x) => s + (Number(x.totalPackedLitres) || 0), 0)

      setIsSaving(true)
      try {
        const requestBody: Record<string, unknown> = {
          batchId,
          batchNumber: batchData.batchNumber,
          packageNumber,
          packagingDate,
          supervisor,
          teamMembers,
          safetyChecks,
          packagingLines,
          idempotencyKey: getOrCreateIdempotencyKey(),
        }
        const response = await fetch("/api/jaba/packaging-output", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || "Failed to save packaging session")
        }
        idempotencyKeyRef.current = null
        const pkg = data.packageNumber || packageNumber
        if (data.idempotentReplay) {
          toast.info("This save was already recorded — inventory was not duplicated.")
        } else {
          toast.success(
            `Saved multi-flavour packaging session ${pkg}. Total ${totalLitres.toFixed(2)}L across ${packagingLines.length} line(s).`
          )
        }
        router.push("/jaba/batches")
      } catch (error: unknown) {
        console.error("Error saving packaging session:", error)
        toast.error(error instanceof Error ? error.message : "Failed to save packaging session")
      } finally {
        setIsSaving(false)
      }
      return
    }

    if (!volumeAllocated || parseFloat(volumeAllocated) <= 0) {
      toast.error("Please enter volume allocated for packaging")
      return
    }

    const totalPacked = calculateOutput()
    if (totalPacked <= 0) {
      toast.error("Please enter container quantities")
      return
    }

    if (packagingStockInsufficient) {
      toast.error(
        "This session needs more bottles or stickers than are available in the warehouse. Reduce quantities or restock before saving."
      )
      return
    }

    const saveFlavour = String(batchData.flavor || batchData.flavour || "").trim()
    const draftQty: Record<(typeof stdSizes)[number], number> = {
      "250ml": 0,
      "500ml": 0,
      "1L": 0,
      "2L": 0,
    }
    for (const c of containers) {
      const sz = c.size as (typeof stdSizes)[number]
      if (stdSizes.includes(sz)) {
        draftQty[sz] += Math.max(0, parseFloat(c.quantity) || 0)
      }
    }
    if (saveFlavour && packagingStock?.bySize) {
      for (const s of stdSizes) {
        if (draftQty[s] > 0 && !packagingStock.bySize[s]?.sticker) {
          toast.error(
            `No flavour-specific sticker item for ${s} and "${saveFlavour}". Create it under Raw Materials → Packaging (Stickers) before packing.`
          )
          return
        }
      }
    }

    const allocated = getAllocatedVolume()
    if (totalPacked > allocated) {
      toast.error(`Total packed (${totalPacked.toFixed(2)}L) exceeds allocated volume (${allocated.toFixed(2)}L)`)
      return
    }

    setIsSaving(true)
    try {
      const requestBody: Record<string, unknown> = {
        batchId: batchId,
        batchNumber: batchData.batchNumber,
        packageNumber: packageNumber,
        volumeAllocated: volumeAllocated,
        packagingDate: packagingDate,
        supervisor: supervisor,
        teamMembers: teamMembers,
        containers: containers,
        totalPackedLitres: totalPacked,
        defects: defects,
        defectReasons: defectReasons,
        machineEfficiency: machineEfficiency,
        safetyChecks: safetyChecks,
        idempotencyKey: getOrCreateIdempotencyKey(),
      }
      const response = await fetch("/api/jaba/packaging-output", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to save packaging session")
      }

      idempotencyKeyRef.current = null
      if (data.idempotentReplay) {
        toast.info("This save was already recorded — inventory was not duplicated.")
      } else {
        toast.success(
          `Packaging session saved! Package: ${data.packaging?.packageNumber || packageNumber}. Packaged ${totalPacked.toFixed(2)}L. Remaining: ${data.packaging.remainingLitres.toFixed(2)}L`
        )
      }

      router.push("/jaba/batches")
    } catch (error: unknown) {
      console.error("Error saving packaging session:", error)
      toast.error(error instanceof Error ? error.message : "Failed to save packaging session")
    } finally {
      setIsSaving(false)
    }
  }

  const updateContainer = (index: number, field: keyof ContainerRow, value: string) => {
    const updated = [...containers]
    updated[index] = { ...updated[index], [field]: value }
    setContainers(updated)
  }

  const addTeamMember = () => {
    if (newMember.trim() && !teamMembers.includes(newMember.trim())) {
      setTeamMembers([...teamMembers, newMember.trim()])
      setNewMember("")
    }
  }

  const removeTeamMember = (index: number) => {
    setTeamMembers(teamMembers.filter((_, i) => i !== index))
  }

  const calculateOutput = () => {
    let totalLitres = 0
    containers.forEach((container) => {
      const qty = Math.max(0, parseFloat(container.quantity) || 0)
      if (container.size === "250ml") {
        totalLitres += qty * 0.25
      } else if (container.size === "500ml") {
        totalLitres += qty * 0.5
      } else if (container.size === "1L") {
        totalLitres += qty * 1
      } else if (container.size === "2L") {
        totalLitres += qty * 2
      } else if (container.customSize) {
        const customSize = parseFloat(container.customSize) || 0
        totalLitres += qty * (customSize / 1000)
      }
    })
    return totalLitres
  }

  // Get allocated volume for validation (what user selected for packaging)
  const getAllocatedVolume = () => {
    return parseFloat(volumeAllocated) || 0
  }

  // Calculate max quantity allowed for a container size based on allocated volume
  const getMaxQuantityForSize = (size: string, customSize?: string) => {
    const allocated = getAllocatedVolume()
    if (allocated <= 0) return 0
    
    if (size === "250ml") {
      return Math.floor(allocated / 0.25)
    } else if (size === "500ml") {
      return Math.floor(allocated / 0.5)
    } else if (size === "1L") {
      return Math.floor(allocated / 1)
    } else if (size === "2L") {
      return Math.floor(allocated / 2)
    } else if (customSize) {
      const customSizeLitres = parseFloat(customSize) / 1000
      if (customSizeLitres <= 0) return 0
      return Math.floor(allocated / customSizeLitres)
    }
    return 0
  }

  // Check if a specific container quantity is valid based on allocated volume
  const isValidContainerQuantity = (index: number, quantity: string) => {
    const container = containers[index]
    const qty = parseFloat(quantity) || 0
    if (quantity.trim() !== "" && qty < 0) {
      return { valid: false, error: "Quantity cannot be negative" }
    }
    if (qty <= 0) return { valid: true, error: "" } // Allow empty or zero
    
    const allocated = getAllocatedVolume()
    if (allocated <= 0) {
      return { valid: false, error: "Please set volume allocated first" }
    }
    
    // Calculate total litres if this quantity is used
    let totalLitres = 0
    containers.forEach((c, idx) => {
      const currentQty = idx === index ? qty : Math.max(0, parseFloat(c.quantity) || 0)
      if (c.size === "250ml") {
        totalLitres += currentQty * 0.25
      } else if (c.size === "500ml") {
        totalLitres += currentQty * 0.5
      } else if (c.size === "1L") {
        totalLitres += currentQty * 1
      } else if (c.size === "2L") {
        totalLitres += currentQty * 2
      } else if (c.customSize) {
        const customSizeLitres = parseFloat(c.customSize) / 1000
        totalLitres += currentQty * customSizeLitres
      }
    })
    
    if (totalLitres > allocated) {
      return { 
        valid: false, 
        error: `Total exceeds allocated volume (${allocated.toFixed(2)}L). Current total: ${totalLitres.toFixed(2)}L` 
      }
    }
    
    const maxQty = getMaxQuantityForSize(container.size, container.customSize)
    if (qty > maxQty) {
      return { 
        valid: false, 
        error: `Max ${maxQty} for this size (${allocated.toFixed(2)}L allocated)` 
      }
    }
    
    return { valid: true, error: "" }
  }

  const allFlavourLines = batchData?.flavourOutputs || []
  const flavourLines = allFlavourLines.filter(
    (l: any) => Math.max(0, Number(l.remainingPackLitres) || 0) > 1e-6
  )
  const hasFlavourOutputs = allFlavourLines.length > 0

  useEffect(() => {
    const lines = (batchData?.flavourOutputs || []).filter(
      (l: any) => Math.max(0, Number(l.remainingPackLitres) || 0) > 1e-6
    )
    if (!lines.length) {
      setStockByFlavourLineId({})
      return
    }
    let cancelled = false
    ;(async () => {
      setStockByLineLoading(true)
      try {
        const entries = await Promise.all(
          lines.map(async (l: any) => {
            const lid = String(l._id || l.id || "")
            const name = String(l.flavourName || l.flavor || "").trim()
            const q = name ? `?flavour=${encodeURIComponent(name)}` : ""
            const res = await fetch(`/api/jaba/packaging-material-stock${q}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Failed to load packaging material stock")
            return [
              lid,
              {
                bySize:
                  data.bySize ??
                  ({
                    "250ml": { bottle: null, sticker: null },
                    "500ml": { bottle: null, sticker: null },
                    "1L": { bottle: null, sticker: null },
                    "2L": { bottle: null, sticker: null },
                  } as Record<
                    "250ml" | "500ml" | "1L" | "2L",
                    { bottle: PackagingStockItem | null; sticker: PackagingStockItem | null }
                  >),
              },
            ] as const
          })
        )
        if (!cancelled) setStockByFlavourLineId(Object.fromEntries(entries))
      } catch (e) {
        console.error(e)
        if (!cancelled) setStockByFlavourLineId({})
      } finally {
        if (!cancelled) setStockByLineLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [batchData?.flavourOutputs, batchId])

  /** Flavour used to resolve sticker SKUs (must match raw material flavour tag / name). */
  const resolvedFlavourForStock = useMemo(() => {
    if (!batchData) return ""
    const allLines = batchData.flavourOutputs || []
    const openLines = allLines.filter(
      (l: any) => Math.max(0, Number(l.remainingPackLitres) || 0) > 1e-6
    )
    if (openLines.length > 0) {
      const line = openLines.find((l: any) => String(l._id || l.id) === selectedFlavourLineId)
      if (!line) return ""
      return String(line.flavourName || line.flavor || "").trim()
    }
    return String(batchData.flavor || batchData.flavour || "").trim()
  }, [batchData, selectedFlavourLineId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setPackagingStockLoading(true)
        const q =
          resolvedFlavourForStock.length > 0
            ? `?flavour=${encodeURIComponent(resolvedFlavourForStock)}`
            : ""
        const res = await fetch(`/api/jaba/packaging-material-stock${q}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to load packaging material stock")
        if (!cancelled) {
          setPackagingStock({
            bottle: data.bottle ?? null,
            sticker: data.sticker ?? null,
            bySize: data.bySize ?? { '250ml': { bottle: null, sticker: null }, '500ml': { bottle: null, sticker: null }, '1L': { bottle: null, sticker: null }, '2L': { bottle: null, sticker: null } },
          })
          setPackagingStockError(null)
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load stock"
        if (!cancelled) setPackagingStockError(msg)
      } finally {
        if (!cancelled) setPackagingStockLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [resolvedFlavourForStock])

  const availableVolume = batchData
    ? flavourLines.length > 0
      ? flavourLines.reduce(
          (sum, l: any) => sum + Math.max(0, Number(l.remainingPackLitres) || 0),
          0
        )
      : hasFlavourOutputs
        ? 0
        : batchData.outputSummary?.remainingLitres !== undefined &&
            batchData.outputSummary.remainingLitres <= batchData.totalLitres
          ? batchData.outputSummary.remainingLitres
          : batchData.totalLitres
    : 0
  
  const remainingLitres = batchData && volumeAllocated
    ? availableVolume - parseFloat(volumeAllocated)
    : availableVolume

  const totalPackedLitres = calculateOutput()
  const allocatedLitres = getAllocatedVolume()
  const packedDeltaLitres = allocatedLitres - totalPackedLitres
  const packedRatio = allocatedLitres > 0 ? Math.min(100, (totalPackedLitres / allocatedLitres) * 100) : 0
  const packagingEfficiency = volumeAllocated && parseFloat(volumeAllocated) > 0
    ? ((totalPackedLitres / parseFloat(volumeAllocated)) * 100).toFixed(1)
    : "0"
  const defectPercentage = containers.reduce((sum, c) => sum + (parseFloat(c.quantity) || 0), 0) > 0
    ? ((parseFloat(defects) / containers.reduce((sum, c) => sum + (parseFloat(c.quantity) || 0), 0)) * 100).toFixed(2)
    : "0"

  const standardSizes = ['250ml', '500ml', '1L', '2L'] as const

  const draftUnitsBySize = standardSizes.reduce(
    (acc, size) => {
      acc[size] = 0
      return acc
    },
    {} as Record<(typeof standardSizes)[number], number>
  )

  for (const c of containers) {
    const size = c.size as (typeof standardSizes)[number]
    if (standardSizes.includes(size)) {
      draftUnitsBySize[size] += Math.max(0, parseFloat(c.quantity) || 0)
    }
  }

  type PreviewEntry = { stock: number; unit: string; name: string; deduct: number }
  let bottlePreviewByDocId = new Map<string, PreviewEntry>()
  let stickerPreviewByDocId = new Map<string, PreviewEntry>()

  for (const size of standardSizes) {
    const bottle = packagingStock?.bySize?.[size]?.bottle
    const sticker = packagingStock?.bySize?.[size]?.sticker

    const qty = draftUnitsBySize[size]
    if (bottle && qty > 0) {
      const existing = bottlePreviewByDocId.get(bottle.id)
      if (existing) existing.deduct += qty
      else bottlePreviewByDocId.set(bottle.id, { stock: bottle.currentStock, unit: bottle.unit, name: bottle.name, deduct: qty })
    }

    if (sticker && qty > 0) {
      const existing = stickerPreviewByDocId.get(sticker.id)
      if (existing) existing.deduct += qty
      else stickerPreviewByDocId.set(sticker.id, { stock: sticker.currentStock, unit: sticker.unit, name: sticker.name, deduct: qty })
    }
  }

  /** Combined bottle/sticker usage when multiple flavour lines are selected (same warehouse SKUs may be shared). */
  if (flavourLines.length > 0) {
    const bMap = new Map<string, PreviewEntry>()
    const sMap = new Map<string, PreviewEntry>()
    for (const l of flavourLines) {
      const lid = String(l._id || l.id)
      const st = lineStates[lid]
      if (!st?.included) continue
      const pack = stockByFlavourLineId[lid]
      const flavourName = String(l.flavourName || l.flavor || "").trim()
      for (const size of standardSizes) {
        let qty = 0
        for (const c of st.containers) {
          if (c.size === size) qty += Math.max(0, parseFloat(c.quantity) || 0)
        }
        const bottle = pack?.bySize?.[size]?.bottle ?? null
        const sticker = pack?.bySize?.[size]?.sticker ?? null
        if (bottle && qty > 0) {
          const existing = bMap.get(bottle.id)
          if (existing) existing.deduct += qty
          else bMap.set(bottle.id, { stock: bottle.currentStock, unit: bottle.unit, name: bottle.name, deduct: qty })
        }
        if (sticker && qty > 0) {
          const existing = sMap.get(sticker.id)
          if (existing) existing.deduct += qty
          else sMap.set(sticker.id, { stock: sticker.currentStock, unit: sticker.unit, name: sticker.name, deduct: qty })
        }
        if (qty > 0 && flavourName && !sticker) {
          /* stickerMissing tracked below */
        }
      }
    }
    bottlePreviewByDocId = bMap
    stickerPreviewByDocId = sMap
  }

  const packagingStockInsufficient = Array.from(bottlePreviewByDocId.values()).some((e) => e.stock - e.deduct < 0) ||
    Array.from(stickerPreviewByDocId.values()).some((e) => e.stock - e.deduct < 0)

  const stickerMissingForPackedSizes =
    flavourLines.length > 0
      ? flavourLines.some((l: any) => {
          const lid = String(l._id || l.id)
          const st = lineStates[lid]
          if (!st?.included) return false
          const pack = stockByFlavourLineId[lid]
          const fname = String(l.flavourName || l.flavor || "").trim()
          return standardSizes.some((size) => {
            let qty = 0
            for (const c of st.containers) {
              if (c.size === size) qty += Math.max(0, parseFloat(c.quantity) || 0)
            }
            return qty > 0 && fname.length > 0 && !pack?.bySize?.[size]?.sticker
          })
        })
      : resolvedFlavourForStock.length > 0 &&
        standardSizes.some((size) => {
          const qty = draftUnitsBySize[size]
          if (qty <= 0) return false
          return !packagingStock?.bySize?.[size]?.sticker
        })

  const packagingMaterialsBlocked = packagingStockInsufficient || stickerMissingForPackedSizes

  const previewBottleRemainingForSize = (size: (typeof standardSizes)[number]) => {
    if (flavourLines.length > 0) {
      const bottle = flavourLines
        .map((l: any) => {
          const lid = String(l._id || l.id)
          if (!lineStates[lid]?.included) return null
          return stockByFlavourLineId[lid]?.bySize?.[size]?.bottle ?? null
        })
        .find((b: PackagingStockItem | null | undefined) => b != null)
      if (!bottle) return null
      const entry = bottlePreviewByDocId.get(bottle.id)
      if (!entry) return bottle.currentStock
      return entry.stock - entry.deduct
    }
    const bottle = packagingStock?.bySize?.[size]?.bottle
    if (!bottle) return null
    const entry = bottlePreviewByDocId.get(bottle.id)
    if (!entry) return bottle.currentStock
    return entry.stock - entry.deduct
  }

  const previewStickerRemainingForSize = (size: (typeof standardSizes)[number]) => {
    if (flavourLines.length > 0) {
      const sticker = flavourLines
        .map((l: any) => {
          const lid = String(l._id || l.id)
          if (!lineStates[lid]?.included) return null
          return stockByFlavourLineId[lid]?.bySize?.[size]?.sticker ?? null
        })
        .find((s: PackagingStockItem | null | undefined) => s != null)
      if (!sticker) return null
      const entry = stickerPreviewByDocId.get(sticker.id)
      if (!entry) return sticker.currentStock
      return entry.stock - entry.deduct
    }
    const sticker = packagingStock?.bySize?.[size]?.sticker
    if (!sticker) return null
    const entry = stickerPreviewByDocId.get(sticker.id)
    if (!entry) return sticker.currentStock
    return entry.stock - entry.deduct
  }

  const getMaterialsPreviewForSize = (size: (typeof standardSizes)[number]) => {
    if (flavourLines.length === 0) {
      return packagingStock?.bySize?.[size] ?? { bottle: null, sticker: null }
    }
    const hit = flavourLines
      .map((l: any) => {
        const lid = String(l._id || l.id)
        if (!lineStates[lid]?.included) return null
        return stockByFlavourLineId[lid]?.bySize?.[size] ?? null
      })
      .find((p) => p?.bottle || p?.sticker)
    return hit ?? stockByFlavourLineId[String(flavourLines[0]?._id || flavourLines[0]?.id)]?.bySize?.[size] ?? {
      bottle: null,
      sticker: null,
    }
  }

  const linePackedLitres = (lid: string) => {
    const st = lineStates[lid]
    if (!st) return 0
    return computePackagedLitresFromContainers(st.containers)
  }

  const getLineMaxQtyForSize = (lid: string, size: string, customSize?: string) => {
    const allocated = parseFloat(lineStates[lid]?.volumeAllocated || "0") || 0
    if (allocated <= 0) return 0
    if (size === "250ml") return Math.floor(allocated / 0.25)
    if (size === "500ml") return Math.floor(allocated / 0.5)
    if (size === "1L") return Math.floor(allocated / 1)
    if (size === "2L") return Math.floor(allocated / 2)
    if (customSize) {
      const customSizeLitres = parseFloat(customSize) / 1000
      if (customSizeLitres <= 0) return 0
      return Math.floor(allocated / customSizeLitres)
    }
    return 0
  }

  const isValidLineContainerQuantity = (
    lid: string,
    index: number,
    quantity: string
  ): { valid: boolean; error: string } => {
    const st = lineStates[lid]
    if (!st) return { valid: true, error: "" }
    const container = st.containers[index]
    const qty = parseFloat(quantity) || 0
    if (quantity.trim() !== "" && qty < 0) {
      return { valid: false, error: "Quantity cannot be negative" }
    }
    if (qty <= 0) return { valid: true, error: "" }
    const allocated = parseFloat(st.volumeAllocated) || 0
    if (allocated <= 0) {
      return { valid: false, error: "Set volume allocated for this line first" }
    }
    let totalLitres = 0
    st.containers.forEach((c, idx) => {
      const currentQty = idx === index ? qty : Math.max(0, parseFloat(c.quantity) || 0)
      if (c.size === "250ml") totalLitres += currentQty * 0.25
      else if (c.size === "500ml") totalLitres += currentQty * 0.5
      else if (c.size === "1L") totalLitres += currentQty * 1
      else if (c.size === "2L") totalLitres += currentQty * 2
      else if (c.customSize) {
        const customSizeLitres = parseFloat(c.customSize) / 1000
        totalLitres += currentQty * customSizeLitres
      }
    })
    if (totalLitres > allocated + 1e-6) {
      return {
        valid: false,
        error: `Total exceeds allocated (${allocated.toFixed(2)}L). Current: ${totalLitres.toFixed(2)}L`,
      }
    }
    const maxQty = getLineMaxQtyForSize(lid, container.size, container.customSize)
    if (qty > maxQty) {
      return { valid: false, error: `Max ${maxQty} for this size (${allocated.toFixed(2)}L allocated)` }
    }
    return { valid: true, error: "" }
  }

  const multiSessionTotalLitres = flavourLines.reduce((sum, l: any) => {
    const lid = String(l._id || l.id)
    if (!lineStates[lid]?.included) return sum
    return sum + linePackedLitres(lid)
  }, 0)

  const multiAllocatedSessionSum = flavourLines.reduce((sum, l: any) => {
    const lid = String(l._id || l.id)
    if (!lineStates[lid]?.included) return sum
    return sum + (parseFloat(lineStates[lid]?.volumeAllocated || "0") || 0)
  }, 0)

  const summaryPackedLitres = flavourLines.length > 0 ? multiSessionTotalLitres : totalPackedLitres
  const summaryAllocatedLitres = flavourLines.length > 0 ? multiAllocatedSessionSum : getAllocatedVolume()
  const summaryOverPacked = summaryPackedLitres > summaryAllocatedLitres + 1e-6

  const stockPanelLoading = packagingStockLoading || (flavourLines.length > 0 && stockByLineLoading)

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 px-6 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
            <Package className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Create Packaging Session</h1>
            <p className="text-sm text-muted-foreground">Convert production output into packaged goods</p>
          </div>
        </div>
        <Link href="/jaba/packaging-output">
          <Button variant="outline" className="border-slate-300 dark:border-slate-700">Cancel</Button>
        </Link>
      </header>

      <div className="p-6 max-w-6xl mx-auto space-y-6 bg-gradient-to-br from-slate-50 via-background to-slate-50 dark:from-slate-950 dark:via-background dark:to-slate-950 min-h-screen">
        {/* Source Information */}
        <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-b border-blue-200 dark:border-blue-900/50">
            <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/30">
                <Factory className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              Source Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="batchId" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Select Batch *</Label>
              <Select 
                value={batchId} 
                onValueChange={(value) => {
                  setBatchId(value)
                  if (value) {
                    fetchBatchData(value)
                  } else {
                    setBatchData(null)
                    setSupervisor("")
                    setVolumeAllocated("")
                    setSelectedFlavourLineId("")
                    setLineStates({})
                  }
                }}
                disabled={loadingBatch}
              >
                <SelectTrigger className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500">
                  <SelectValue placeholder={loadingBatch ? "Loading batch..." : "Select batch"} />
                </SelectTrigger>
                <SelectContent>
                  {availableBatches.length > 0 ? (
                    availableBatches.map((batch) => (
                      <SelectItem key={batch._id || batch.id} value={batch._id || batch.id}>
                        {batch.batchNumber} - {batch.flavor} ({batch.totalLitres}L)
                      </SelectItem>
                    ))
                  ) : (
                    productionOutputs
                    .filter((b) => b.status === "Stored")
                    .map((batch) => (
                      <SelectItem key={batch.id} value={batch.id}>
                        {batch.batchNumber} - {batch.flavor} ({batch.totalLitres}L available)
                      </SelectItem>
                      ))
                  )}
                </SelectContent>
              </Select>
              {batchData && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/30 border-2 border-green-200 dark:border-green-900/50 shadow-sm space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/50 border border-green-200 dark:border-green-800/50">
                      <Package className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-green-900 dark:text-green-100 mb-1.5">
                        {batchData.batchNumber} — master batch ({batchData.flavor})
                      </p>
                      <div className="flex flex-wrap gap-3 text-xs text-green-800 dark:text-green-200">
                        <span className="flex items-center gap-1">
                          <Droplet className="h-3 w-3" />
                          Produced: {batchData.totalLitres}L
                        </span>
                        <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                          <Warehouse className="h-3 w-3" />
                          {flavourLines.length > 0
                            ? `Remaining on line: ${availableVolume.toFixed(2)}L`
                            : `Remaining: ${availableVolume.toFixed(2)}L`}
                        </span>
                      </div>
                    </div>
                  </div>
                  {flavourLines.length > 0 && (
                    <div className="space-y-3 pt-1 border-t border-green-200/70 dark:border-green-900/50">
                      <Label className="text-xs font-semibold text-green-900 dark:text-green-100">
                        Flavour lines in this session
                      </Label>
                      <p className="text-xs text-green-800/90 dark:text-green-200/90">
                        Tick every flavour you are packaging in this save. Stock checks combine all selected lines.
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {flavourLines.map((l: any) => {
                          const lid = String(l._id || l.id)
                          const checked = Boolean(lineStates[lid]?.included)
                          return (
                            <label
                              key={lid}
                              className={cn(
                                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                                checked
                                  ? "border-emerald-400 bg-emerald-50/90 dark:border-emerald-700 dark:bg-emerald-950/40"
                                  : "border-green-200/80 bg-white/70 dark:border-green-900/50 dark:bg-slate-900/50"
                              )}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => patchLineState(lid, { included: v === true })}
                                className="mt-0.5"
                              />
                              <span className="space-y-1 text-sm leading-snug">
                                <span className="font-bold text-green-900 dark:text-green-50">
                                  {l.flavourName || l.flavor}
                                </span>
                                <span className="block text-[11px] text-muted-foreground">
                                  Alloc {Number(l.allocatedLitres || 0).toFixed(2)}L · Left to pack{" "}
                                  {Number(l.remainingPackLitres ?? 0).toFixed(2)}L
                                </span>
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {hasFlavourOutputs && flavourLines.length === 0 && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50/90 dark:bg-amber-950/30 dark:border-amber-700 p-3 mt-2">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                        All flavour lines for this batch are fully packaged. Nothing left to package here.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            {flavourLines.length === 0 && (
              <div className="space-y-2">
                <Label htmlFor="volumeAllocated" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Volume Allocated for Packaging (Litres) *
                </Label>
                <Input
                  id="volumeAllocated"
                  type="number"
                  placeholder="0"
                  value={volumeAllocated}
                  onChange={(e) => setVolumeAllocated(e.target.value)}
                  max={batchData ? availableVolume : undefined}
                  className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500"
                />
                {selectedBatch && volumeAllocated && (
                  <div
                    className={cn(
                      "p-4 rounded-xl border-2 shadow-sm transition-all",
                      remainingLitres >= 0
                        ? "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-900/50"
                        : "bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-red-200 dark:border-red-900/50"
                    )}
                  >
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          After this packaging session:
                        </span>
                        <span
                          className={cn(
                            "font-bold text-base",
                            remainingLitres >= 0 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
                          )}
                        >
                          {remainingLitres >= 0 ? `${remainingLitres.toFixed(2)}L` : "Invalid allocation"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {remainingLitres >= 0
                          ? `This is the volume that will remain in storage after packaging ${parseFloat(volumeAllocated).toFixed(2)}L`
                          : "Allocated volume exceeds available volume"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            {flavourLines.length > 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/80 dark:border-blue-900 dark:bg-blue-950/30 px-3 py-2 text-xs text-blue-900 dark:text-blue-100">
                Volume is set <span className="font-semibold">per flavour line</span> below. Combined bottles and stickers
                are validated against warehouse stock in one go.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Packaging Details */}
        <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 border-b border-purple-200 dark:border-purple-900/50">
            <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/30">
                <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              Packaging Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="packageNumber" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Package Number</Label>
                <Input
                  id="packageNumber"
                  value={packageNumber}
                  readOnly
                  className="h-11 border-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 font-mono font-semibold text-indigo-600 dark:text-indigo-400"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">Auto-generated</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="packagingDate" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Packaging Date *</Label>
                <Input
                  id="packagingDate"
                  type="date"
                  value={packagingDate}
                  onChange={(e) => setPackagingDate(e.target.value)}
                  className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-purple-500 dark:focus:border-purple-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="packagingLine" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Packaging Line Number</Label>
                <Input
                  id="packagingLine"
                  value={
                    batchData?.batchNumber
                      ? `${new Date(packagingDate || new Date().toISOString()).getFullYear()}-${batchData.batchNumber}-LXX`
                      : ""
                  }
                  readOnly
                  placeholder="Auto-generated when saving"
                  className="h-11 border-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 font-mono"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">Auto-generated from year + batch number + line sequence</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="supervisor" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Packaging Supervisor *</Label>
                <Input
                  id="supervisor"
                  placeholder="Supervisor name"
                  value={supervisor}
                  onChange={(e) => setSupervisor(e.target.value)}
                  className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-purple-500 dark:focus:border-purple-500"
                />
              </div>
            </div>

            {/* Team Members */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Packaging Team Members *</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Team member name"
                  value={newMember}
                  onChange={(e) => setNewMember(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addTeamMember()}
                  className="flex-1 h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-purple-500 dark:focus:border-purple-500"
                />
                <Button onClick={addTeamMember} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/30">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {teamMembers.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {teamMembers.map((member, idx) => (
                    <Badge key={idx} variant="secondary" className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-300">
                      <Users className="h-3 w-3" />
                      {member}
                      <button onClick={() => removeTeamMember(idx)} className="ml-1 hover:text-red-600 transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Container Types */}
        <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-b border-emerald-200 dark:border-emerald-900/50">
            <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/30">
                <Package className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              Container Types & Quantities
            </CardTitle>
            <p className="text-sm text-muted-foreground pt-1">
              Each filled unit uses one bottle and one sticker from raw materials. Numbers below update as you type; stock is only deducted when you save this session.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div
              className={cn(
                "rounded-xl border-2 p-4 space-y-3",
                stockPanelLoading
                  ? "border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/40"
                  : packagingStockError
                    ? "border-amber-200 bg-amber-50/90 dark:border-amber-900/50 dark:bg-amber-950/25"
                    : packagingMaterialsBlocked
                      ? "border-red-200 bg-red-50/90 dark:border-red-900/50 dark:bg-red-950/20"
                      : "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/40 dark:bg-emerald-950/25"
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Layers className="h-4 w-4 text-emerald-700 dark:text-emerald-300 shrink-0" />
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Raw materials (warehouse)
                  {flavourLines.length > 1 && (
                    <span className="text-muted-foreground font-normal"> — combined session preview</span>
                  )}
                </span>
                {stockPanelLoading && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
                )}
              </div>
              {packagingStockError && (
                <p className="text-sm text-amber-800 dark:text-amber-200">{packagingStockError}</p>
              )}
              {!stockPanelLoading && !packagingStockError && (flavourLines.length === 0 ? packagingStock?.bySize : true) && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {standardSizes.map((size) => {
                    const mat = getMaterialsPreviewForSize(size)
                    const b = mat?.bottle ?? null
                    const s = mat?.sticker ?? null
                    const afterB = previewBottleRemainingForSize(size)
                    const afterS = previewStickerRemainingForSize(size)

                    return (
                      <div
                        key={size}
                        className="rounded-lg border border-emerald-200/80 bg-white/90 dark:bg-slate-900/70 dark:border-emerald-900/50 px-3 py-2.5 space-y-2"
                      >
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{size}</p>

                        <div className="space-y-0.5">
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                            Bottles
                          </p>
                          {b ? (
                            <>
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50 truncate" title={b.name}>
                                {b.name}
                              </p>
                              <p className="text-sm mt-0.5">
                                <span className="text-muted-foreground">In stock:</span>{" "}
                                <span className="font-bold tabular-nums">{b.currentStock.toLocaleString()}</span>{" "}
                                {b.unit}
                              </p>
                              {afterB !== null && (
                                <p
                                  className={cn(
                                    "text-sm mt-0.5",
                                    afterB < 0 ? "text-red-600 dark:text-red-400 font-semibold" : "text-emerald-700 dark:text-emerald-300"
                                  )}
                                >
                                  After this session (preview):{" "}
                                  <span className="tabular-nums font-bold">{afterB.toLocaleString()}</span> {b.unit}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-amber-700 dark:text-amber-300">
                              No bottle item found for this size.
                            </p>
                          )}
                        </div>

                        <div className="space-y-0.5">
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                            Stickers / labels
                          </p>
                          {s ? (
                            <>
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50 truncate" title={s.name}>
                                {s.name}
                              </p>
                              <p className="text-sm mt-0.5">
                                <span className="text-muted-foreground">In stock:</span>{" "}
                                <span className="font-bold tabular-nums">{s.currentStock.toLocaleString()}</span>{" "}
                                {s.unit}
                              </p>
                              {afterS !== null && (
                                <p
                                  className={cn(
                                    "text-sm mt-0.5",
                                    afterS < 0 ? "text-red-600 dark:text-red-400 font-semibold" : "text-emerald-700 dark:text-emerald-300"
                                  )}
                                >
                                  After this session (preview):{" "}
                                  <span className="tabular-nums font-bold">{afterS.toLocaleString()}</span> {s.unit}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-amber-700 dark:text-amber-300">
                              No sticker item found for this size.
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {flavourLines.length === 0 && resolvedFlavourForStock.length > 0 && !stockPanelLoading && !packagingStockError && (
                <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  Sticker preview uses flavour-specific SKUs for{" "}
                  <span className="font-bold text-emerald-800 dark:text-emerald-200">{resolvedFlavourForStock}</span>.
                </p>
              )}
              {flavourLines.length > 0 &&
                !flavourLines.some((l: any) => lineStates[String(l._id || l.id)]?.included) &&
                !stockPanelLoading && (
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Tick at least one flavour line above to enter container quantities.
                  </p>
                )}
              {stickerMissingForPackedSizes && !stockPanelLoading && (
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  You entered quantities but there is no flavour-specific sticker item for one or more sizes. Create
                  matching sticker rows under Raw Materials (Packaging) or pick a flavour line that matches your sticker
                  names.
                </p>
              )}
              {packagingStockInsufficient && !stockPanelLoading && (
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  This session needs more bottles or stickers than are in stock. Reduce quantities or restock before saving.
                </p>
              )}
            </div>

            {flavourLines.length > 0 ? (
              <div className="space-y-6">
                {flavourLines.map((line: any) => {
                  const lid = String(line._id || line.id)
                  const st = lineStates[lid]
                  if (!st?.included) return null
                  const allocLine = Number(line.allocatedLitres) || 0
                  const leftBefore = Number(line.remainingPackLitres) || 0
                  const packed = linePackedLitres(lid)
                  const volAlloc = parseFloat(st.volumeAllocated) || 0
                  const delta = volAlloc - packed
                  const ratio = volAlloc > 0 ? Math.min(100, (packed / volAlloc) * 100) : 0
                  return (
                    <div
                      key={lid}
                      className="rounded-xl border-2 border-indigo-200/90 bg-gradient-to-br from-white to-indigo-50/40 dark:from-slate-900 dark:to-indigo-950/30 dark:border-indigo-900/60 p-4 sm:p-5 space-y-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                            Flavour line
                          </p>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                            {line.flavourName || line.flavor}
                          </h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">Alloc: {allocLine.toFixed(2)}L</Badge>
                          <Badge variant="secondary">Left before: {leftBefore.toFixed(2)}L</Badge>
                          <Badge variant="outline" className="border-emerald-400 text-emerald-800 dark:text-emerald-200">
                            This session: {packed.toFixed(2)}L
                          </Badge>
                          <Badge variant="outline" className="border-amber-400">
                            After (preview): {Math.max(0, leftBefore - packed).toFixed(2)}L
                          </Badge>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">Volume for this session (L) *</Label>
                          <Input
                            type="number"
                            value={st.volumeAllocated}
                            onChange={(e) => patchLineState(lid, { volumeAllocated: e.target.value })}
                            max={leftBefore}
                            className="h-11 border-2"
                          />
                          <p className="text-[11px] text-muted-foreground">Max {leftBefore.toFixed(2)}L left on this line.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold">Defects</Label>
                            <Input
                              type="number"
                              value={st.defects}
                              onChange={(e) => patchLineState(lid, { defects: e.target.value })}
                              className="h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold">Machine eff. %</Label>
                            <Input
                              type="number"
                              value={st.machineEfficiency}
                              onChange={(e) => patchLineState(lid, { machineEfficiency: e.target.value })}
                              className="h-10"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Defect reasons</Label>
                        <Textarea
                          value={st.defectReasons}
                          onChange={(e) => patchLineState(lid, { defectReasons: e.target.value })}
                          className="min-h-[56px] text-sm"
                        />
                      </div>
                      <div className="space-y-3 pt-1 border-t border-indigo-200/60 dark:border-indigo-900/50">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Containers</p>
                        {st.containers.map((container, index) => (
                          <div
                            key={index}
                            className="grid gap-4 md:grid-cols-4 items-end p-4 rounded-lg bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
                          >
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold">Size</Label>
                              {container.size === "custom" ? (
                                <div className="flex gap-2">
                                  <Input
                                    placeholder="ml"
                                    value={container.customSize || ""}
                                    onChange={(e) => updateLineContainer(lid, index, "customSize", e.target.value)}
                                    className="h-11 border-2"
                                  />
                                  <span className="self-center text-sm">ml</span>
                                </div>
                              ) : (
                                <Select
                                  value={container.size}
                                  onValueChange={(value) => updateLineContainer(lid, index, "size", value)}
                                >
                                  <SelectTrigger className="h-11 border-2">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="250ml">250ml</SelectItem>
                                    <SelectItem value="500ml">500ml</SelectItem>
                                    <SelectItem value="1L">1L</SelectItem>
                                    <SelectItem value="2L">2L</SelectItem>
                                    <SelectItem value="custom">Custom Size</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold">
                                Qty
                                {st.volumeAllocated && (
                                  <span className="text-xs font-normal text-muted-foreground ml-1">
                                    (max {getLineMaxQtyForSize(lid, container.size, container.customSize)})
                                  </span>
                                )}
                              </Label>
                              <Input
                                type="number"
                                min={0}
                                value={container.quantity}
                                onChange={(e) => updateLineContainer(lid, index, "quantity", e.target.value)}
                                className={cn(
                                  "h-11 border-2",
                                  container.quantity &&
                                    !isValidLineContainerQuantity(lid, index, container.quantity).valid &&
                                    "border-red-500"
                                )}
                              />
                              {container.quantity && !isValidLineContainerQuantity(lid, index, container.quantity).valid && (
                                <p className="text-xs text-red-600">
                                  {isValidLineContainerQuantity(lid, index, container.quantity).error}
                                </p>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold">Litres</Label>
                              <div className="p-2 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-sm font-bold text-blue-800 dark:text-blue-200">
                                {computePackagedLitresFromContainers([container]).toFixed(2)}L
                              </div>
                            </div>
                            {st.containers.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeLineContainerRow(lid, index)}
                                className="text-red-600"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button
                          type="button"
                          onClick={() => addLineContainerRow(lid)}
                          variant="outline"
                          className="w-full border-dashed"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add container size
                        </Button>
                      </div>
                      <div
                        className={cn(
                          "rounded-lg border p-3 text-sm",
                          delta < 0
                            ? "border-red-200 bg-red-50/80 dark:border-red-900 dark:bg-red-950/30"
                            : "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/25"
                        )}
                      >
                        <div className="flex justify-between items-center gap-2">
                          <span className="font-medium text-slate-800 dark:text-slate-100">Line fill</span>
                          <Badge variant="outline" className={delta < 0 ? "text-red-700" : "text-emerald-700"}>
                            {delta < 0 ? `Over by ${Math.abs(delta).toFixed(2)}L` : `${delta.toFixed(2)}L headroom`}
                          </Badge>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={cn("h-full transition-all", delta < 0 ? "bg-red-500" : "bg-emerald-500")}
                            style={{ width: `${ratio}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div className="rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/50 p-4">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Session totals (preview)</p>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                    {multiSessionTotalLitres.toFixed(2)}L
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sum of packed litres across all selected flavour lines in this save.
                  </p>
                </div>
              </div>
            ) : (
            <>
            {containers.map((container, index) => (
              <div key={index} className="grid gap-4 md:grid-cols-4 items-end p-5 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-900/50 border-2 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Size</Label>
                  {container.size === "custom" ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Custom size (ml)"
                        value={container.customSize || ""}
                        onChange={(e) => updateContainer(index, "customSize", e.target.value)}
                        className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-emerald-500 dark:focus:border-emerald-500"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 px-2 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                        onClick={() => updateContainer(index, "customSize", "250")}
                      >
                        Auto 250
                      </Button>
                      <span className="text-sm text-slate-600 dark:text-slate-400 self-center font-medium">ml</span>
                    </div>
                  ) : (
                    <Select value={container.size} onValueChange={(value) => updateContainer(index, "size", value)}>
                      <SelectTrigger className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-emerald-500 dark:focus:border-emerald-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="250ml">250ml</SelectItem>
                        <SelectItem value="500ml">500ml</SelectItem>
                        <SelectItem value="1L">1L</SelectItem>
                        <SelectItem value="2L">2L</SelectItem>
                        <SelectItem value="custom">Custom Size</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Quantity Produced
                    {volumeAllocated && (
                      <span className="text-xs font-normal text-muted-foreground ml-2">
                        (Max: {getMaxQuantityForSize(container.size, container.customSize)})
                      </span>
                    )}
                  </Label>
                  <Input
                    type="number"
                    placeholder="0"
                    min={0}
                    value={container.quantity}
                    onChange={(e) => {
                      const value = e.target.value
                      if (value === "" || value === ".") {
                        updateContainer(index, "quantity", value)
                        return
                      }
                      const n = parseFloat(value)
                      if (!Number.isNaN(n) && n < 0) {
                        updateContainer(index, "quantity", "0")
                        return
                      }
                      updateContainer(index, "quantity", value)
                    }}
                    max={volumeAllocated ? getMaxQuantityForSize(container.size, container.customSize) : undefined}
                    className={cn(
                      "h-11 border-2 focus:border-emerald-500 dark:focus:border-emerald-500",
                      container.quantity && !isValidContainerQuantity(index, container.quantity).valid
                        ? "border-red-500 dark:border-red-500 bg-red-50 dark:bg-red-950/30"
                        : "border-slate-300 dark:border-slate-700"
                    )}
                  />
                  {container.quantity && !isValidContainerQuantity(index, container.quantity).valid && (
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                      {isValidContainerQuantity(index, container.quantity).error}
                    </p>
                  )}
                  {Math.max(0, parseFloat(container.quantity) || 0) > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      Uses {Math.max(0, parseFloat(container.quantity) || 0).toLocaleString()} bottle
                      {Math.max(0, parseFloat(container.quantity) || 0) !== 1 ? "s" : ""} +{" "}
                      {Math.max(0, parseFloat(container.quantity) || 0).toLocaleString()} sticker
                      {Math.max(0, parseFloat(container.quantity) || 0) !== 1 ? "s" : ""} (preview)
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Litres</Label>
                  <div className="p-3 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-2 border-blue-200 dark:border-blue-900/50">
                    <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                      {container.size === "250ml"
                        ? (Math.max(0, parseFloat(container.quantity) || 0) * 0.25).toFixed(2)
                        : container.size === "500ml"
                          ? (Math.max(0, parseFloat(container.quantity) || 0) * 0.5).toFixed(2)
                          : container.size === "1L"
                            ? Math.max(0, parseFloat(container.quantity) || 0).toFixed(2)
                            : container.size === "2L"
                              ? (Math.max(0, parseFloat(container.quantity) || 0) * 2).toFixed(2)
                              : container.customSize
                                ? (Math.max(0, parseFloat(container.quantity) || 0) * (parseFloat(container.customSize) / 1000)).toFixed(2)
                                : "0.00"}L
                    </span>
                  </div>
                </div>
                {containers.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeContainerRow(index)}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button onClick={addContainerRow} variant="outline" className="w-full border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all">
              <Plus className="mr-2 h-4 w-4" />
              Add Container Size
            </Button>

            <div className={cn(
              "rounded-xl border-2 p-4 space-y-3 shadow-sm",
              packedDeltaLitres < 0
                ? "border-red-200 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/20"
                : "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20"
            )}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Live filling accuracy
                </p>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    packedDeltaLitres < 0
                      ? "border-red-300 text-red-700 dark:border-red-800 dark:text-red-300"
                      : "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300"
                  )}
                >
                  {packedDeltaLitres < 0
                    ? `Over by ${Math.abs(packedDeltaLitres).toFixed(2)}L`
                    : `${packedDeltaLitres.toFixed(2)}L left`}
                </Badge>
              </div>

              <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all",
                    packedDeltaLitres < 0 ? "bg-red-500" : "bg-emerald-500"
                  )}
                  style={{ width: `${packedRatio}%` }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="rounded-md bg-white/80 dark:bg-slate-900/60 px-3 py-2 border border-slate-200 dark:border-slate-700">
                  <p className="text-muted-foreground">Allocated</p>
                  <p className="font-bold text-slate-900 dark:text-slate-100">{allocatedLitres.toFixed(2)}L</p>
                </div>
                <div className="rounded-md bg-white/80 dark:bg-slate-900/60 px-3 py-2 border border-slate-200 dark:border-slate-700">
                  <p className="text-muted-foreground">Packed so far</p>
                  <p className="font-bold text-slate-900 dark:text-slate-100">{totalPackedLitres.toFixed(2)}L</p>
                </div>
                <div className="rounded-md bg-white/80 dark:bg-slate-900/60 px-3 py-2 border border-slate-200 dark:border-slate-700">
                  <p className="text-muted-foreground">Fill ratio</p>
                  <p className="font-bold text-slate-900 dark:text-slate-100">{allocatedLitres > 0 ? `${packedRatio.toFixed(1)}%` : "0.0%"}</p>
                </div>
              </div>
            </div>
            </>
            )}
          </CardContent>
        </Card>

        {/* Quality & Efficiency */}
        <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-b border-amber-200 dark:border-amber-900/50">
            <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/30">
                <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              Quality & Efficiency
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            {flavourLines.length === 0 && (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="defects" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Defects/Rejected Bottles
                    </Label>
                    <Input
                      id="defects"
                      type="number"
                      placeholder="0"
                      value={defects}
                      onChange={(e) => setDefects(e.target.value)}
                      className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-amber-500 dark:focus:border-amber-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="machineEfficiency" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Machine Efficiency (%)
                    </Label>
                    <Input
                      id="machineEfficiency"
                      type="number"
                      placeholder="0"
                      value={machineEfficiency}
                      onChange={(e) => setMachineEfficiency(e.target.value)}
                      max={100}
                      className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-amber-500 dark:focus:border-amber-500"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defectReasons" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Defect Reasons
                  </Label>
                  <Textarea
                    id="defectReasons"
                    placeholder="Describe reasons for defects..."
                    value={defectReasons}
                    onChange={(e) => setDefectReasons(e.target.value)}
                    className="min-h-[80px] border-2 border-slate-300 dark:border-slate-700 focus:border-amber-500 dark:focus:border-amber-500"
                  />
                </div>
              </>
            )}
            {flavourLines.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Defects and machine efficiency are captured per flavour line in the packaging blocks above.
              </p>
            )}
            <div className="flex items-center space-x-3 p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-2 border-green-200 dark:border-green-900/50 shadow-sm">
              <input
                type="checkbox"
                id="safetyChecks"
                checked={safetyChecks}
                onChange={(e) => setSafetyChecks(e.target.checked)}
                className="h-5 w-5 rounded border-2 border-green-300 dark:border-green-700 text-green-600 focus:ring-green-500 focus:ring-2"
              />
              <Label htmlFor="safetyChecks" className="text-sm font-semibold cursor-pointer flex items-center gap-2 text-green-900 dark:text-green-100">
                <CheckCircle className={cn("h-4 w-4", safetyChecks ? "text-green-600" : "text-slate-400")} />
                Safety checks completed
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Output Summary */}
        <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 border-b border-indigo-200 dark:border-indigo-900/50">
            <CardTitle className="text-lg font-bold text-card-foreground flex items-center gap-2">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/30">
                <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              Output Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className={cn(
                "p-5 rounded-xl border-2 shadow-md hover:shadow-lg transition-shadow",
                summaryOverPacked
                  ? "bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/40 dark:to-rose-950/40 border-red-200 dark:border-red-900/50"
                  : "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/40 border-green-200 dark:border-green-900/50"
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <Droplet className={cn(
                    "h-4 w-4",
                    summaryOverPacked
                      ? "text-red-600 dark:text-red-400" 
                      : "text-green-600 dark:text-green-400"
                  )} />
                  <p className={cn(
                    "text-sm font-semibold uppercase tracking-wide",
                    summaryOverPacked
                      ? "text-red-900 dark:text-red-100"
                      : "text-green-900 dark:text-green-100"
                  )}>
                    Total Litres Packed
                    {(flavourLines.length > 0 ? multiAllocatedSessionSum > 0 : volumeAllocated) && (
                      <span className="text-xs font-normal normal-case ml-2">
                        (of {summaryAllocatedLitres.toFixed(2)}L allocated this session)
                      </span>
                    )}
                  </p>
                </div>
                <p className={cn(
                  "text-3xl font-bold",
                  summaryOverPacked
                    ? "text-red-600 dark:text-red-400"
                    : "text-green-600 dark:text-green-400"
                )}>
                  {summaryPackedLitres.toFixed(2)}L
                </p>
                {summaryOverPacked && (
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-2">
                    Exceeds allocated volume by {(summaryPackedLitres - summaryAllocatedLitres).toFixed(2)}L
                  </p>
                )}
              </div>
              <div className="p-5 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border-2 border-amber-200 dark:border-amber-900/50 shadow-md hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <Warehouse className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 uppercase tracking-wide">Remaining in Storage</p>
                </div>
                {flavourLines.length > 0 ? (
                  <p className="text-sm text-amber-800 dark:text-amber-200 leading-snug">
                    Neutral / master batch storage is tracked at batch level; each flavour line card above shows remaining
                    litres for that line after this session.
                  </p>
                ) : (
                  <p className={cn(
                    "text-3xl font-bold",
                    remainingLitres >= 0 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
                  )}>
                    {remainingLitres >= 0 ? `${remainingLitres.toFixed(2)}L` : "Invalid"}
                  </p>
                )}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-5 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-2 border-blue-200 dark:border-blue-900/50 shadow-md hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 uppercase tracking-wide">Packaging Efficiency</p>
                </div>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {flavourLines.length > 0
                    ? summaryAllocatedLitres > 0
                      ? ((summaryPackedLitres / summaryAllocatedLitres) * 100).toFixed(1)
                      : "0.0"
                    : packagingEfficiency}
                  %
                </p>
              </div>
              <div className="p-5 rounded-xl bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/40 dark:to-rose-950/40 border-2 border-red-200 dark:border-red-900/50 shadow-md hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <p className="text-sm font-semibold text-red-900 dark:text-red-100 uppercase tracking-wide">Defect Percentage</p>
                </div>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                  {flavourLines.length > 0 ? "—" : `${defectPercentage}%`}
                </p>
                {flavourLines.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">Per-line defects are entered in each flavour block.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-wrap justify-end gap-3 pt-4">
          <Link href="/jaba/packaging-output">
            <Button variant="outline" className="border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
              Cancel
            </Button>
          </Link>
          <Button variant="outline" className="border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30">
            <Printer className="mr-2 h-4 w-4" />
            Print Report
          </Button>
          <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg shadow-green-500/30">
            <Warehouse className="mr-2 h-4 w-4" />
            Move to Warehouse
          </Button>
          <Button 
            onClick={handleSavePackaging}
            disabled={isSaving || !batchId || packagingMaterialsBlocked}
            className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg shadow-red-500/30"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
            <Save className="mr-2 h-4 w-4" />
            Save Packaging Session
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  )
}

export default function CreatePackagingSessionPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-red-600" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <CreatePackagingSessionPageContent />
    </Suspense>
  )
}
