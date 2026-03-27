"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { 
  Save, 
  RotateCw, 
  Move, 
  Square, 
  Circle, 
  RectangleHorizontal, 
  Hexagon, 
  Octagon,
  Minus,
  Plus,
  Grid3X3,
  Loader2,
  Trash2,
  Edit2,
  Layout,
  X
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface TableData {
  id: number
  name?: string
  status: 'available' | 'occupied' | 'reserved'
  capacity?: number
  shape?: 'circle' | 'square' | 'rectangle' | 'oval' | 'hexagon' | 'octagon'
  position?: { x: number; y: number }
  size?: { width: number; height: number }
  rotation?: number
}

interface BarTop {
  shape: 'straight' | 'curved' | 'l-shaped' | 'u-shaped' | 'custom'
  position: { x: number; y: number }
  size: { width: number; height: number }
  rotation?: number
  color?: string
}

interface FloorPlan {
  width: number
  height: number
  scale?: number
}

interface LayoutDesignerProps {
  tables: TableData[]
  onTablesUpdate: (tables: TableData[]) => void
}

export function LayoutDesigner({ tables, onTablesUpdate }: LayoutDesignerProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const initializedRef = useRef(false)
  const [selectedTable, setSelectedTable] = useState<TableData | null>(null)
  const [selectedBarTop, setSelectedBarTop] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const [barTop, setBarTop] = useState<BarTop | null>(null)
  const [floorPlan, setFloorPlan] = useState<FloorPlan>({ width: 2000, height: 1500, scale: 1 })
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Load bar layout on mount
  useEffect(() => {
    loadBarLayout()
  }, [])

  // Initialize table positions if they don't have them (only once)
  useEffect(() => {
    if (tables.length > 0 && !isLoading) {
      const tablesNeedingPositions = tables.filter(t => !t.position)
      if (tablesNeedingPositions.length > 0 && !initializedRef.current) {
        initializedRef.current = true
        const updatedTables = tables.map((table, index) => {
          if (!table.position) {
            return {
              ...table,
              position: { 
                x: 100 + ((index % 5) * 120), 
                y: 100 + (Math.floor(index / 5) * 120) 
              },
              size: table.size || { width: 80, height: 80 },
            }
          }
          return table
        })
        // Use setTimeout to avoid state update during render
        setTimeout(() => {
          onTablesUpdate(updatedTables)
        }, 0)
      }
    }
  }, [tables.length, isLoading]) // Run when tables are loaded

  const loadBarLayout = async () => {
    try {
      const response = await fetch('/api/catha/layout')
      const data = await response.json()
      if (data.success && data.layout) {
        if (data.layout.barTop) {
          setBarTop(data.layout.barTop)
        }
        if (data.layout.floorPlan) {
          setFloorPlan(data.layout.floorPlan)
          setScale(data.layout.floorPlan.scale || 1)
        }
      }
    } catch (error) {
      console.error('Error loading bar layout:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const saveBarLayout = async () => {
    try {
      setIsSaving(true)
      const response = await fetch('/api/catha/layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barTop: barTop,
          floorPlan: floorPlan,
        }),
      })

      const data = await response.json()
      if (data.success) {
        toast.success('Bar layout saved successfully')
      } else {
        toast.error(data.error || 'Failed to save bar layout')
      }
    } catch (error) {
      console.error('Error saving bar layout:', error)
      toast.error('Failed to save bar layout')
    } finally {
      setIsSaving(false)
    }
  }

  const saveTablePositions = async () => {
    try {
      setIsSaving(true)
      // Update all tables with their current positions
      const updatePromises = tables.map(table =>
        fetch('/api/catha/tables', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: table.id,
            shape: table.shape || 'circle',
            position: table.position,
            size: table.size,
            rotation: table.rotation || 0,
          }),
        })
      )

      await Promise.all(updatePromises)
      toast.success('Table positions saved successfully')
      onTablesUpdate([...tables])
    } catch (error) {
      console.error('Error saving table positions:', error)
      toast.error('Failed to save table positions')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveAll = async () => {
    await saveBarLayout()
    await saveTablePositions()
    // Clear selection after saving
    setSelectedTable(null)
    setSelectedBarTop(false)
  }


  const getTableColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-emerald-400 border-emerald-600'
      case 'occupied':
        return 'bg-red-400 border-red-600'
      case 'reserved':
        return 'bg-amber-400 border-amber-600'
      default:
        return 'bg-gray-400 border-gray-600'
    }
  }

  const handleMouseDown = (e: React.MouseEvent, table: TableData) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Select the table
    setSelectedTable(table)
    setSelectedBarTop(false)
    
    // Get current position or use default
    let currentPosition = table.position
    if (!currentPosition) {
      const tableIndex = tables.findIndex(t => t.id === table.id)
      currentPosition = { x: 100 + (tableIndex * 120), y: 100 + (Math.floor(tableIndex / 5) * 120) }
      // Update table with position immediately
      const updatedTables = tables.map(t =>
        t.id === table.id
          ? { ...t, position: currentPosition }
          : t
      )
      onTablesUpdate(updatedTables)
    }
    
    // Start dragging immediately
    const rect = canvasRef.current?.getBoundingClientRect()
    if (rect) {
      // Calculate offset - mouse position minus the table's current position (scaled)
      const tableX = currentPosition.x * scale
      const tableY = currentPosition.y * scale
      const offsetX = e.clientX - rect.left - tableX
      const offsetY = e.clientY - rect.top - tableY
      
      setDragOffset({
        x: offsetX,
        y: offsetY,
      })
      setIsDragging(true)
    }
  }

  const handleBarTopMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Select the bar top
    setSelectedBarTop(true)
    setSelectedTable(null)
    
    // Start dragging immediately
    if (barTop) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (rect) {
        // Calculate offset accounting for scale
        setDragOffset({
          x: e.clientX - rect.left - (barTop.position.x * scale),
          y: e.clientY - rect.top - (barTop.position.y * scale),
        })
        setIsDragging(true)
      }
    }
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    // Calculate new position: mouse position minus offset, then convert to unscaled coordinates
    const newX = (e.clientX - rect.left - dragOffset.x) / scale
    const newY = (e.clientY - rect.top - dragOffset.y) / scale

    if (selectedBarTop && barTop) {
      const maxX = floorPlan.width - (barTop.size.width || 400)
      const maxY = floorPlan.height - (barTop.size.height || 60)
      setBarTop({
        ...barTop,
        position: { 
          x: Math.max(0, Math.min(newX, maxX)), 
          y: Math.max(0, Math.min(newY, maxY)) 
        },
      })
    } else if (selectedTable) {
      const tableSize = selectedTable.size || { width: 80, height: 80 }
      const maxX = floorPlan.width - tableSize.width
      const maxY = floorPlan.height - tableSize.height
      
      const newPosition = {
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      }
      
      // Update tables array with new position
      const updatedTables = tables.map(t =>
        t.id === selectedTable.id
          ? { ...t, position: newPosition }
          : t
      )
      
      // Update state immediately
      onTablesUpdate(updatedTables)
      
      // Also update selectedTable to keep it in sync
      setSelectedTable(prev => prev ? { ...prev, position: newPosition } : null)
    }
  }, [isDragging, dragOffset, selectedTable, selectedBarTop, barTop, tables, onTablesUpdate, scale, floorPlan])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const updateTableProperty = (tableId: number, property: string, value: any) => {
    const updatedTables = tables.map(t =>
      t.id === tableId ? { ...t, [property]: value } : t
    )
    onTablesUpdate(updatedTables)
    if (selectedTable?.id === tableId) {
      setSelectedTable({ ...selectedTable, [property]: value })
    }
  }

  const updateBarTopProperty = (property: string, value: any) => {
    if (barTop) {
      setBarTop({ ...barTop, [property]: value })
    }
  }

  const getBarTopStyle = (): React.CSSProperties => {
    if (!barTop) return {}
    
    const position = barTop.position || { x: 100, y: 100 }
    const size = barTop.size || { width: 400, height: 60 }
    const rotation = barTop.rotation || 0

    return {
      position: 'absolute',
      left: `${position.x * scale}px`,
      top: `${position.y * scale}px`,
      width: `${size.width * scale}px`,
      height: `${size.height * scale}px`,
      transform: `rotate(${rotation}deg)`,
      backgroundColor: barTop.color || '#8B4513',
      cursor: 'move',
      zIndex: selectedBarTop ? 10 : 2,
      borderRadius: barTop.shape === 'curved' ? '30px' : '4px',
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card className="border-2 border-amber-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Layout className="h-5 w-5" />
              Bar Layout Designer
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setScale(Math.max(0.5, scale - 0.1))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Badge variant="outline" className="px-3">
                {Math.round(scale * 100)}%
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setScale(Math.min(2, scale + 0.1))}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleSaveAll}
                disabled={isSaving}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Layout
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Table Controls */}
            {selectedTable && (
              <div className="space-y-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center justify-between">
                  <Label className="font-bold">Editing: {selectedTable.name || `Table ${selectedTable.id}`}</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedTable(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Shape</Label>
                  <Select
                    value={selectedTable.shape || 'circle'}
                    onValueChange={(value) => {
                      // Set appropriate default size based on shape
                      let newSize = selectedTable.size || { width: 80, height: 80 }
                      if (value === 'rectangle') {
                        newSize = { width: 120, height: 80 }
                      } else if (value === 'oval') {
                        newSize = { width: 100, height: 60 }
                      } else if (value === 'square' || value === 'circle' || value === 'hexagon' || value === 'octagon') {
                        const currentSize = selectedTable.size?.width || 80
                        newSize = { width: currentSize, height: currentSize }
                      }
                      
                      // Update both shape and size in a single operation
                      const updatedTables = tables.map(t =>
                        t.id === selectedTable.id 
                          ? { ...t, shape: value, size: newSize }
                          : t
                      )
                      onTablesUpdate(updatedTables)
                      
                      // Update selectedTable to keep it in sync
                      setSelectedTable({ ...selectedTable, shape: value, size: newSize })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="circle">Circle</SelectItem>
                      <SelectItem value="square">Square</SelectItem>
                      <SelectItem value="rectangle">Rectangle</SelectItem>
                      <SelectItem value="oval">Oval</SelectItem>
                      <SelectItem value="hexagon">Hexagon</SelectItem>
                      <SelectItem value="octagon">Octagon</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>Width</Label>
                    <Input
                      type="number"
                      value={selectedTable.size?.width || 80}
                      onChange={(e) => {
                        const newWidth = parseInt(e.target.value) || 80
                        // For square and circle, keep width and height the same
                        if (selectedTable.shape === 'square' || selectedTable.shape === 'circle') {
                          updateTableProperty(selectedTable.id, 'size', {
                            width: newWidth,
                            height: newWidth,
                          })
                        } else {
                          updateTableProperty(selectedTable.id, 'size', {
                            ...selectedTable.size,
                            width: newWidth,
                            height: selectedTable.size?.height || 80,
                          })
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Height</Label>
                    <Input
                      type="number"
                      value={selectedTable.size?.height || 80}
                      onChange={(e) => {
                        const newHeight = parseInt(e.target.value) || 80
                        // For square and circle, keep width and height the same
                        if (selectedTable.shape === 'square' || selectedTable.shape === 'circle') {
                          updateTableProperty(selectedTable.id, 'size', {
                            width: newHeight,
                            height: newHeight,
                          })
                        } else {
                          updateTableProperty(selectedTable.id, 'size', {
                            ...selectedTable.size,
                            width: selectedTable.size?.width || 80,
                            height: newHeight,
                          })
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Rotation: {selectedTable.rotation || 0}°</Label>
                  <Slider
                    value={[selectedTable.rotation || 0]}
                    onValueChange={([value]) => updateTableProperty(selectedTable.id, 'rotation', value)}
                    min={0}
                    max={360}
                    step={1}
                  />
                </div>
              </div>
            )}

            {/* Bar Top Controls */}
            <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <Label className="font-bold">Bar Top</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (barTop) {
                      setSelectedBarTop(!selectedBarTop)
                      setSelectedTable(null)
                    } else {
                      setBarTop({
                        shape: 'straight',
                        position: { x: 100, y: 100 },
                        size: { width: 400, height: 60 },
                        rotation: 0,
                        color: '#8B4513',
                      })
                      setSelectedBarTop(true)
                    }
                  }}
                >
                  {barTop ? (selectedBarTop ? 'Deselect' : 'Select') : 'Add Bar Top'}
                </Button>
              </div>
              {barTop && (
                <>
                  <div className="space-y-2">
                    <Label>Shape</Label>
                    <Select
                      value={barTop.shape}
                      onValueChange={(value) => updateBarTopProperty('shape', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="straight">Straight</SelectItem>
                        <SelectItem value="curved">Curved</SelectItem>
                        <SelectItem value="l-shaped">L-Shaped</SelectItem>
                        <SelectItem value="u-shaped">U-Shaped</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Width</Label>
                      <Input
                        type="number"
                        value={barTop.size.width}
                        onChange={(e) =>
                          updateBarTopProperty('size', {
                            ...barTop.size,
                            width: parseInt(e.target.value) || 400,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Height</Label>
                      <Input
                        type="number"
                        value={barTop.size.height}
                        onChange={(e) =>
                          updateBarTopProperty('size', {
                            ...barTop.size,
                            height: parseInt(e.target.value) || 60,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <Input
                      type="color"
                      value={barTop.color || '#8B4513'}
                      onChange={(e) => updateBarTopProperty('color', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rotation: {barTop.rotation || 0}°</Label>
                    <Slider
                      value={[barTop.rotation || 0]}
                      onValueChange={([value]) => updateBarTopProperty('rotation', value)}
                      min={0}
                      max={360}
                      step={1}
                    />
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setBarTop(null)
                      setSelectedBarTop(false)
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove Bar Top
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Canvas */}
      <Card className="border-2 border-amber-200">
        <CardContent className="p-4">
          <div
            ref={canvasRef}
            className="relative bg-gradient-to-br from-amber-50 to-stone-50 border-2 border-amber-300 rounded-lg overflow-auto"
            style={{
              width: '100%',
              height: '600px',
              minHeight: '600px',
              position: 'relative',
            }}
            onMouseDown={(e) => {
              // Only deselect if clicking directly on the canvas (not on a table/bar top)
              if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('canvas-background')) {
                setSelectedTable(null)
                setSelectedBarTop(false)
              }
            }}
          >
            {/* Floor Plan Background */}
            <div
              className="absolute inset-0 canvas-background"
              style={{
                width: `${floorPlan.width * scale}px`,
                height: `${floorPlan.height * scale}px`,
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 49px, rgba(0,0,0,0.05) 49px, rgba(0,0,0,0.05) 50px), repeating-linear-gradient(90deg, transparent, transparent 49px, rgba(0,0,0,0.05) 49px, rgba(0,0,0,0.05) 50px)',
              }}
            />

            {/* Bar Top */}
            {barTop && (
              <div
                style={getBarTopStyle()}
                onMouseDown={handleBarTopMouseDown}
                className={cn(
                  "border-2 shadow-lg",
                  selectedBarTop ? "border-blue-500 ring-2 ring-blue-300 cursor-move" : "border-amber-800 cursor-pointer"
                )}
              >
                <div className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm pointer-events-none">
                  BAR
                </div>
              </div>
            )}

            {/* Tables */}
            {tables.length > 0 ? tables.map((table, index) => {
              // Use position if exists, otherwise calculate default (but don't update state here)
              const position = table.position || { x: 100 + (index * 120), y: 100 + (Math.floor(index / 5) * 120) }
              const size = table.size || { width: 80, height: 80 }
              const isSelected = selectedTable?.id === table.id
              const shape = table.shape || 'circle'
              
              // Base style with position and transform
              const baseStyle: React.CSSProperties = {
                position: 'absolute',
                left: `${position.x * scale}px`,
                top: `${position.y * scale}px`,
                transform: `rotate(${table.rotation || 0}deg)`,
                cursor: isSelected ? 'move' : 'pointer',
                zIndex: isSelected ? 10 : 1,
                userSelect: 'none',
                transition: isDragging && isSelected ? 'none' : 'all 0.1s ease',
              }

              // Apply shape-specific styles with dimensions
              let shapeStyle: React.CSSProperties = {}
              switch (shape) {
                case 'square':
                  const squareSize = size.width * scale
                  shapeStyle = { 
                    borderRadius: '4px',
                    width: `${squareSize}px`,
                    height: `${squareSize}px`,
                  }
                  break
                case 'rectangle':
                  shapeStyle = { 
                    borderRadius: '4px',
                    width: `${size.width * scale}px`,
                    height: `${size.height * scale}px`,
                  }
                  break
                case 'oval':
                  shapeStyle = { 
                    borderRadius: '50%',
                    width: `${size.width * scale}px`,
                    height: `${size.height * scale}px`,
                  }
                  break
                case 'hexagon':
                  const hexSize = size.width * scale
                  shapeStyle = { 
                    clipPath: 'polygon(30% 0%, 70% 0%, 100% 50%, 70% 100%, 30% 100%, 0% 50%)',
                    borderRadius: '0',
                    width: `${hexSize}px`,
                    height: `${hexSize}px`,
                  }
                  break
                case 'octagon':
                  const octSize = size.width * scale
                  shapeStyle = { 
                    clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)',
                    borderRadius: '0',
                    width: `${octSize}px`,
                    height: `${octSize}px`,
                  }
                  break
                default: // circle
                  const circleSize = size.width * scale
                  shapeStyle = { 
                    borderRadius: '50%',
                    width: `${circleSize}px`,
                    height: `${circleSize}px`,
                  }
              }

              return (
                <div
                  key={`table-${table.id}-${shape}`}
                  style={{
                    ...baseStyle,
                    ...shapeStyle,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, table)}
                  className={cn(
                    "border-2 shadow-lg flex items-center justify-center text-white font-bold text-xs",
                    getTableColor(table.status),
                    isSelected && "ring-4 ring-amber-400",
                    isSelected && "opacity-90"
                  )}
                >
                  <div className="text-center pointer-events-none">
                    <div className="text-lg font-black">{table.id}</div>
                    {table.name && (
                      <div className="text-xs opacity-90">{table.name}</div>
                    )}
                  </div>
                </div>
              )
            }) : (
              <div className="absolute inset-0 flex items-center justify-center text-stone-500">
                <p>No tables available. Add tables in the List view first.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

