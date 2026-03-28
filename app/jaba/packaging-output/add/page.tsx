"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, X, Save, Printer, Warehouse, Package, Factory, Users, CheckCircle, TrendingUp, AlertCircle, Droplet, Loader2 } from "lucide-react"
import Link from "next/link"
import { productionOutputs } from "@/lib/jaba-data"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface ContainerRow {
  size: string
  quantity: string
  customSize?: string
}

function CreatePackagingSessionPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [batchId, setBatchId] = useState("")
  const [volumeAllocated, setVolumeAllocated] = useState("")
  const [packagingDate, setPackagingDate] = useState(new Date().toISOString().split("T")[0])
  const [packagingLine, setPackagingLine] = useState("")
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

  // Fetch available batches for selection
  useEffect(() => {
    fetchAvailableBatches()
  }, [])

  // Get batchId from URL params if available and fetch batch data
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
    const lines = batchData.flavourOutputs
    if (!lines.some((l: any) => String(l._id || l.id) === fid)) return
    setSelectedFlavourLineId(fid)
    const line = lines.find((l: any) => String(l._id || l.id) === fid)
    if (line) {
      const cap = Math.max(0, Number(line.remainingPackLitres) || 0)
      setVolumeAllocated(cap > 0 ? String(cap) : String(Number(line.allocatedLitres) || 0))
    }
  }, [searchParams, batchData])

  const fetchAvailableBatches = async () => {
    try {
      const response = await fetch('/api/jaba/batches')
      const data = await response.json()
      
      if (response.ok && data.batches) {
        // Filter batches that are ready for packaging
        const readyBatches = data.batches.filter((b: any) => 
          b.status === "QC Passed - Ready for Packaging" || 
          b.status === "Processed" ||
          b.status === "Partially Packaged" ||
          b.status === "Partially Allocated" ||
          b.status === "Fully Allocated" ||
          (b.qcStatus === "Pass" && b.status !== "Ready for Distribution")
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
        const lines = data.batch.flavourOutputs || []
        if (lines.length > 0) {
          const pick =
            lines.find((l: any) => Number(l.remainingPackLitres) > 1e-6) || lines[0]
          setSelectedFlavourLineId(String(pick._id || pick.id || ""))
          const cap = Math.max(0, Number(pick.remainingPackLitres) || 0)
          setVolumeAllocated(cap > 0 ? String(cap) : String(Number(pick.allocatedLitres) || 0))
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
    setContainers([...containers, { size: "custom", quantity: "", customSize: "" }])
  }

  const removeContainerRow = (index: number) => {
    setContainers(containers.filter((_, i) => i !== index))
  }

  const handleSavePackaging = async () => {
    if (!batchId || !batchData) {
      toast.error("Please select a batch")
      return
    }

    if (!volumeAllocated || parseFloat(volumeAllocated) <= 0) {
      toast.error("Please enter volume allocated for packaging")
      return
    }

    if (!packagingLine) {
      toast.error("Please enter packaging line number")
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

    const totalPacked = calculateOutput()
    if (totalPacked <= 0) {
      toast.error("Please enter container quantities")
      return
    }

    // Validate that total packed doesn't exceed allocated volume
    const allocated = getAllocatedVolume()
    if (totalPacked > allocated) {
      toast.error(`Total packed (${totalPacked.toFixed(2)}L) exceeds allocated volume (${allocated.toFixed(2)}L)`)
      return
    }

    setIsSaving(true)
    try {
      console.log('[Packaging Form] Sending package number:', packageNumber)
      const lines = batchData.flavourOutputs || []
      const requestBody: Record<string, unknown> = {
        batchId: batchId,
        batchNumber: batchData.batchNumber,
        packageNumber: packageNumber,
        volumeAllocated: volumeAllocated,
        packagingDate: packagingDate,
        packagingLine: packagingLine,
        supervisor: supervisor,
        teamMembers: teamMembers,
        containers: containers,
        totalPackedLitres: totalPacked,
        defects: defects,
        defectReasons: defectReasons,
        machineEfficiency: machineEfficiency,
        safetyChecks: safetyChecks,
      }
      if (lines.length > 0) {
        if (!selectedFlavourLineId) {
          toast.error("Select a flavour line for this batch")
          setIsSaving(false)
          return
        }
        requestBody.flavourLineId = selectedFlavourLineId
      }
      console.log('[Packaging Form] Request body:', JSON.stringify(requestBody, null, 2))
      
      const response = await fetch('/api/jaba/packaging-output', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save packaging session')
      }

      console.log('[Packaging Form] Response received:', data)
      console.log('[Packaging Form] Package number in response:', data.packaging?.packageNumber)
      
      toast.success(`Packaging session saved! Package: ${data.packaging?.packageNumber || packageNumber}. Packaged ${totalPacked.toFixed(2)}L. Remaining: ${data.packaging.remainingLitres.toFixed(2)}L`)
      
      // Redirect back to batches page to see updated remaining litres
      router.push('/jaba/batches')
    } catch (error: any) {
      console.error('Error saving packaging session:', error)
      toast.error(error.message || 'Failed to save packaging session')
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
      const qty = parseFloat(container.quantity) || 0
      if (container.size === "500ml") {
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
    
    if (size === "500ml") {
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
    if (qty <= 0) return { valid: true, error: "" } // Allow empty or zero
    
    const allocated = getAllocatedVolume()
    if (allocated <= 0) {
      return { valid: false, error: "Please set volume allocated first" }
    }
    
    // Calculate total litres if this quantity is used
    let totalLitres = 0
    containers.forEach((c, idx) => {
      const currentQty = idx === index ? qty : (parseFloat(c.quantity) || 0)
      if (c.size === "500ml") {
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

  const flavourLines = batchData?.flavourOutputs || []
  const selectedLine = flavourLines.find(
    (l: any) => String(l._id || l.id) === selectedFlavourLineId
  )

  const availableVolume = batchData
    ? flavourLines.length > 0 && selectedLine
      ? Math.max(0, Number(selectedLine.remainingPackLitres) || 0)
      : batchData.outputSummary?.remainingLitres !== undefined &&
          batchData.outputSummary.remainingLitres <= batchData.totalLitres
        ? batchData.outputSummary.remainingLitres
        : batchData.totalLitres
    : 0
  
  const remainingLitres = batchData && volumeAllocated
    ? availableVolume - parseFloat(volumeAllocated)
    : availableVolume

  const totalPackedLitres = calculateOutput()
  const packagingEfficiency = volumeAllocated && parseFloat(volumeAllocated) > 0
    ? ((totalPackedLitres / parseFloat(volumeAllocated)) * 100).toFixed(1)
    : "0"
  const defectPercentage = containers.reduce((sum, c) => sum + (parseFloat(c.quantity) || 0), 0) > 0
    ? ((parseFloat(defects) / containers.reduce((sum, c) => sum + (parseFloat(c.quantity) || 0), 0)) * 100).toFixed(2)
    : "0"

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
                        {batchData.qcStatus && (
                        <Badge variant="outline" className="text-xs border-green-300 dark:border-green-700 text-green-700 dark:text-green-300">
                            QC: {batchData.qcStatus}
                        </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {flavourLines.length > 0 && (
                    <div className="space-y-2 pt-1 border-t border-green-200/70 dark:border-green-900/50">
                      <Label className="text-xs font-semibold text-green-900 dark:text-green-100">
                        Flavour line to package *
                      </Label>
                      <Select
                        value={selectedFlavourLineId}
                        onValueChange={(v) => {
                          setSelectedFlavourLineId(v)
                          const line = flavourLines.find(
                            (l: any) => String(l._id || l.id) === v
                          )
                          if (line) {
                            const cap = Math.max(0, Number(line.remainingPackLitres) || 0)
                            setVolumeAllocated(
                              cap > 0 ? String(cap) : String(Number(line.allocatedLitres) || 0)
                            )
                          }
                        }}
                      >
                        <SelectTrigger className="h-10 border-green-200 dark:border-green-900 bg-white/80 dark:bg-slate-900">
                          <SelectValue placeholder="Choose flavour" />
                        </SelectTrigger>
                        <SelectContent>
                          {flavourLines.map((l: any) => (
                            <SelectItem key={l._id || l.id} value={String(l._id || l.id)}>
                              {l.flavourName || l.flavor} — {Number(l.allocatedLitres).toFixed(1)}L alloc ·{" "}
                              {Number(l.remainingPackLitres ?? 0).toFixed(1)}L left to pack
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="volumeAllocated" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Volume Allocated for Packaging (Litres) *</Label>
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
                <div className={cn(
                  "p-4 rounded-xl border-2 shadow-sm transition-all",
                  remainingLitres >= 0 
                    ? "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-900/50"
                    : "bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-red-200 dark:border-red-900/50"
                )}>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">After this packaging session:</span>
                      <span className={cn(
                        "font-bold text-base",
                        remainingLitres >= 0 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
                      )}>
                        {remainingLitres >= 0 ? `${remainingLitres.toFixed(2)}L` : "Invalid allocation"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {remainingLitres >= 0 
                        ? `This is the volume that will remain in storage after packaging ${parseFloat(volumeAllocated).toFixed(2)}L`
                        : "Allocated volume exceeds available volume"
                      }
                    </p>
                  </div>
                </div>
              )}
            </div>
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                <Label htmlFor="packagingLine" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Packaging Line Number *</Label>
                <Input
                  id="packagingLine"
                  placeholder="e.g., LINE-01"
                  value={packagingLine}
                  onChange={(e) => setPackagingLine(e.target.value)}
                  className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-purple-500 dark:focus:border-purple-500"
                />
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
          </CardHeader>
          <CardContent className="space-y-4 p-6">
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
                      <span className="text-sm text-slate-600 dark:text-slate-400 self-center font-medium">ml</span>
                    </div>
                  ) : (
                    <Select value={container.size} onValueChange={(value) => updateContainer(index, "size", value)}>
                      <SelectTrigger className="h-11 border-2 border-slate-300 dark:border-slate-700 focus:border-emerald-500 dark:focus:border-emerald-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
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
                    value={container.quantity}
                    onChange={(e) => {
                      const value = e.target.value
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
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Litres</Label>
                  <div className="p-3 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-2 border-blue-200 dark:border-blue-900/50">
                    <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                      {container.size === "500ml"
                        ? ((parseFloat(container.quantity) || 0) * 0.5).toFixed(2)
                        : container.size === "1L"
                        ? (parseFloat(container.quantity) || 0).toFixed(2)
                        : container.size === "2L"
                        ? ((parseFloat(container.quantity) || 0) * 2).toFixed(2)
                        : container.customSize
                        ? ((parseFloat(container.quantity) || 0) * (parseFloat(container.customSize) / 1000)).toFixed(2)
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
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="defects" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Defects/Rejected Bottles</Label>
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
                <Label htmlFor="machineEfficiency" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Machine Efficiency (%)</Label>
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
              <Label htmlFor="defectReasons" className="text-sm font-semibold text-slate-700 dark:text-slate-300">Defect Reasons</Label>
              <Textarea
                id="defectReasons"
                placeholder="Describe reasons for defects..."
                value={defectReasons}
                onChange={(e) => setDefectReasons(e.target.value)}
                className="min-h-[80px] border-2 border-slate-300 dark:border-slate-700 focus:border-amber-500 dark:focus:border-amber-500"
              />
            </div>
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
                totalPackedLitres > getAllocatedVolume()
                  ? "bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/40 dark:to-rose-950/40 border-red-200 dark:border-red-900/50"
                  : "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/40 border-green-200 dark:border-green-900/50"
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <Droplet className={cn(
                    "h-4 w-4",
                    totalPackedLitres > getAllocatedVolume() 
                      ? "text-red-600 dark:text-red-400" 
                      : "text-green-600 dark:text-green-400"
                  )} />
                  <p className={cn(
                    "text-sm font-semibold uppercase tracking-wide",
                    totalPackedLitres > getAllocatedVolume()
                      ? "text-red-900 dark:text-red-100"
                      : "text-green-900 dark:text-green-100"
                  )}>
                    Total Litres Packed
                    {volumeAllocated && (
                      <span className="text-xs font-normal normal-case ml-2">
                        (of {getAllocatedVolume().toFixed(2)}L allocated)
                      </span>
                    )}
                  </p>
                </div>
                <p className={cn(
                  "text-3xl font-bold",
                  totalPackedLitres > getAllocatedVolume()
                    ? "text-red-600 dark:text-red-400"
                    : "text-green-600 dark:text-green-400"
                )}>
                  {totalPackedLitres.toFixed(2)}L
                </p>
                {totalPackedLitres > getAllocatedVolume() && (
                  <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-2">
                    Exceeds allocated volume by {(totalPackedLitres - getAllocatedVolume()).toFixed(2)}L
                  </p>
                )}
              </div>
              <div className="p-5 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border-2 border-amber-200 dark:border-amber-900/50 shadow-md hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <Warehouse className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 uppercase tracking-wide">Remaining in Storage</p>
                </div>
                <p className={cn(
                  "text-3xl font-bold",
                  remainingLitres >= 0 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
                )}>
                  {remainingLitres >= 0 ? `${remainingLitres.toFixed(2)}L` : "Invalid"}
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-5 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-2 border-blue-200 dark:border-blue-900/50 shadow-md hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 uppercase tracking-wide">Packaging Efficiency</p>
                </div>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{packagingEfficiency}%</p>
              </div>
              <div className="p-5 rounded-xl bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/40 dark:to-rose-950/40 border-2 border-red-200 dark:border-red-900/50 shadow-md hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <p className="text-sm font-semibold text-red-900 dark:text-red-100 uppercase tracking-wide">Defect Percentage</p>
                </div>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">{defectPercentage}%</p>
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
            disabled={isSaving || !batchId}
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
