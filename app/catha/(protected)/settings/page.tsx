"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { toast as sonnerToast } from "sonner"
import { staff } from "@/lib/dummy-data"
import { Building, Users, Bell, Shield, Printer, Receipt, Smartphone, Loader2, Truck, MapPin, Store } from "lucide-react"

interface Settings {
  businessInfo?: {
    businessName: string
    phone: string
    address: string
    currency: string
    vatRate: number
  }
  receipt?: {
    autoPrint: boolean
    includeVatBreakdown: boolean
    footerMessage: string
  }
  notifications?: {
    lowStockAlerts: boolean
    dailySalesSummary: boolean
    newOrderNotifications: boolean
    supplierDeliveryReminders: boolean
  }
  security?: {
    requirePinForVoids: boolean
    autoLogout: string
    twoFactorAuth: boolean
  }
  etims?: {
    enabled: boolean
    environment: 'sandbox' | 'production'
    taxpayerPin: string
    branchOfficeId: string
    communicationKey: string
    equipmentInfo?: string
  }
  mpesa?: {
    enabled: boolean
    environment: 'sandbox' | 'production'
    consumerKey: string
    consumerSecret: string
    passkey: string
    shortcode: string
    confirmationUrl: string
    validationUrl: string
    callbackUrl: string
  }
  delivery?: {
    pickupAddress: string
    pickupDirectionsUrl?: string
    options: Array<{
      value: string
      label: string
      fee: number
      subtext: string
      enabled: boolean
    }>
  }
}

export default function SettingsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Business Info State
  const [businessName, setBusinessName] = useState("Catha Lounge")
  const [phone, setPhone] = useState("+254 712 345678")
  const [address, setAddress] = useState("Westlands, Nairobi, Kenya")
  const [currency, setCurrency] = useState("kes")
  const [vatRate, setVatRate] = useState(16)
  
  // Receipt Settings State
  const [autoPrint, setAutoPrint] = useState(true)
  const [includeVatBreakdown, setIncludeVatBreakdown] = useState(true)
  const [footerMessage, setFooterMessage] = useState("Thank you for visiting!")
  
  // Notifications State
  const [lowStockAlerts, setLowStockAlerts] = useState(true)
  const [dailySalesSummary, setDailySalesSummary] = useState(true)
  const [newOrderNotifications, setNewOrderNotifications] = useState(false)
  const [supplierDeliveryReminders, setSupplierDeliveryReminders] = useState(true)
  
  // Security State
  const [requirePinForVoids, setRequirePinForVoids] = useState(true)
  const [autoLogout, setAutoLogout] = useState("15")
  const [twoFactorAuth, setTwoFactorAuth] = useState(false)
  
  // eTIMS State
  const [etimsEnabled, setEtimsEnabled] = useState(false)
  const [etimsEnvironment, setEtimsEnvironment] = useState<'sandbox' | 'production'>('sandbox')
  const [taxpayerPin, setTaxpayerPin] = useState("")
  const [branchOfficeId, setBranchOfficeId] = useState("")
  const [communicationKey, setCommunicationKey] = useState("")
  const [equipmentInfo, setEquipmentInfo] = useState("")

  // M-Pesa State
  const [mpesaEnabled, setMpesaEnabled] = useState(false)
  const [mpesaEnvironment, setMpesaEnvironment] = useState<'sandbox' | 'production'>('sandbox')
  const [consumerKey, setConsumerKey] = useState("")
  const [consumerSecret, setConsumerSecret] = useState("")
  const [passkey, setPasskey] = useState("")
  const [shortcode, setShortcode] = useState("")
  const [confirmationUrl, setConfirmationUrl] = useState("")
  const [validationUrl, setValidationUrl] = useState("")
  const [callbackUrl, setCallbackUrl] = useState("")
  const [registeringUrls, setRegisteringUrls] = useState(false)

  // Delivery / E-commerce checkout settings
  const [pickupAddress, setPickupAddress] = useState("Catha Lounge – Nairobi (exact address confirmed at order)")
  const [pickupDirectionsUrl, setPickupDirectionsUrl] = useState("")
  const [deliveryOptions, setDeliveryOptions] = useState<Array<{ value: string; label: string; fee: number; subtext: string; enabled: boolean }>>([
    { value: "deliver_to_my_location", label: "Deliver to My Location", fee: 350, subtext: "Delivery fee applies", enabled: true },
    { value: "collect_at_catha_lodge", label: "Collect at Catha Lodge", fee: 0, subtext: "No delivery fee", enabled: true },
    { value: "nairobi_cbd", label: "Deliver within Nairobi CBD", fee: 200, subtext: "KES 200 delivery", enabled: true },
    { value: "westlands", label: "Deliver within Westlands", fee: 200, subtext: "KES 200 delivery", enabled: true },
    { value: "kilimani", label: "Deliver within Kilimani", fee: 200, subtext: "KES 200 delivery", enabled: true },
  ])

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/catha/settings')
        const data = await response.json()
        
        if (data.success && data.settings) {
          const settings = data.settings
          
          // Business Info
          if (settings.businessInfo) {
            setBusinessName(settings.businessInfo.businessName || "Catha Lounge")
            setPhone(settings.businessInfo.phone || "+254 712 345678")
            setAddress(settings.businessInfo.address || "Westlands, Nairobi, Kenya")
            setCurrency(settings.businessInfo.currency || "kes")
            setVatRate(settings.businessInfo.vatRate || 16)
          }
          
          // Receipt Settings
          if (settings.receipt) {
            setAutoPrint(settings.receipt.autoPrint ?? true)
            setIncludeVatBreakdown(settings.receipt.includeVatBreakdown ?? true)
            setFooterMessage(settings.receipt.footerMessage || "Thank you for visiting!")
          }
          
          // Notifications
          if (settings.notifications) {
            setLowStockAlerts(settings.notifications.lowStockAlerts ?? true)
            setDailySalesSummary(settings.notifications.dailySalesSummary ?? true)
            setNewOrderNotifications(settings.notifications.newOrderNotifications ?? false)
            setSupplierDeliveryReminders(settings.notifications.supplierDeliveryReminders ?? true)
          }
          
          // Security
          if (settings.security) {
            setRequirePinForVoids(settings.security.requirePinForVoids ?? true)
            setAutoLogout(settings.security.autoLogout || "15")
            setTwoFactorAuth(settings.security.twoFactorAuth ?? false)
          }
          
          // eTIMS
          if (settings.etims) {
            setEtimsEnabled(settings.etims.enabled ?? false)
            setEtimsEnvironment(settings.etims.environment || 'sandbox')
            setTaxpayerPin(settings.etims.taxpayerPin || "")
            setBranchOfficeId(settings.etims.branchOfficeId || "")
            setCommunicationKey(settings.etims.communicationKey || "")
            setEquipmentInfo(settings.etims.equipmentInfo || "")
          }

          // M-Pesa
          if (settings.mpesa) {
            setMpesaEnabled(settings.mpesa.enabled ?? false)
            setMpesaEnvironment(settings.mpesa.environment || 'sandbox')
            setConsumerKey(settings.mpesa.consumerKey || "")
            setConsumerSecret(settings.mpesa.consumerSecret || "")
            setPasskey(settings.mpesa.passkey || "")
            setShortcode(settings.mpesa.shortcode || "")
            setConfirmationUrl(settings.mpesa.confirmationUrl || "")
            setValidationUrl(settings.mpesa.validationUrl || "")
            setCallbackUrl(settings.mpesa.callbackUrl || "")
          }

          // Delivery (e-commerce checkout)
          if (settings.delivery) {
            setPickupAddress(settings.delivery.pickupAddress || "Catha Lounge – Nairobi (exact address confirmed at order)")
            setPickupDirectionsUrl(settings.delivery.pickupDirectionsUrl || "")
            if (settings.delivery.options && settings.delivery.options.length > 0) {
              setDeliveryOptions(settings.delivery.options)
            }
          }
        }
      } catch (error) {
        console.error('Error loading settings:', error)
        toast({
          title: "Error",
          description: "Failed to load settings",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }
    
    loadSettings()
  }, [toast])

  const saveBusinessInfo = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/catha/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessInfo: {
            businessName,
            phone,
            address,
            currency,
            vatRate: Number(vatRate),
          },
        }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast({
          title: "Success",
          description: "Business information saved successfully",
        })
      } else {
        throw new Error(data.error || 'Failed to save')
      }
    } catch (error: any) {
      console.error('Error saving business info:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to save business information",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const saveReceiptSettings = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/catha/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receipt: {
            autoPrint,
            includeVatBreakdown,
            footerMessage,
          },
        }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast({
          title: "Success",
          description: "Receipt settings saved successfully",
        })
      } else {
        throw new Error(data.error || 'Failed to save')
      }
    } catch (error: any) {
      console.error('Error saving receipt settings:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to save receipt settings",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const saveNotifications = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/catha/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notifications: {
            lowStockAlerts,
            dailySalesSummary,
            newOrderNotifications,
            supplierDeliveryReminders,
          },
        }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast({
          title: "Success",
          description: "Notification preferences saved successfully",
        })
      } else {
        throw new Error(data.error || 'Failed to save')
      }
    } catch (error: any) {
      console.error('Error saving notifications:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to save notification preferences",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const saveSecurity = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/catha/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          security: {
            requirePinForVoids,
            autoLogout,
            twoFactorAuth,
          },
        }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast({
          title: "Success",
          description: "Security settings saved successfully",
        })
      } else {
        throw new Error(data.error || 'Failed to save')
      }
    } catch (error: any) {
      console.error('Error saving security settings:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to save security settings",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const registerC2BUrls = async () => {
    setRegisteringUrls(true)
    try {
      // Validate required fields
      if (!consumerKey || !consumerSecret || !passkey || !shortcode) {
        toast({
          title: "Validation Error",
          description: "Consumer Key, Consumer Secret, Passkey, and Shortcode are required to register URLs",
          variant: "destructive",
        })
        setRegisteringUrls(false)
        return
      }

      // Ensure settings are saved first
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin
      const defaultCallbackUrl = `${baseUrl}/api/mpesa/callback`
      const defaultValidationUrl = `${baseUrl}/api/c2b/validation`
      const defaultConfirmationUrl = `${baseUrl}/api/c2b/confirmation`

      // Save settings first if not already saved
      const saveResponse = await fetch('/api/catha/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mpesa: {
            enabled: mpesaEnabled,
            environment: mpesaEnvironment,
            consumerKey,
            consumerSecret,
            passkey,
            shortcode,
            confirmationUrl: confirmationUrl || defaultConfirmationUrl,
            validationUrl: validationUrl || defaultValidationUrl,
            callbackUrl: callbackUrl || defaultCallbackUrl,
          },
        }),
      })

      const saveData = await saveResponse.json()
      if (!saveData.success) {
        throw new Error('Failed to save settings before registering URLs')
      }

      // Register C2B URLs
      const registerResponse = await fetch('/api/mpesa/register-urls', {
        method: 'POST',
      })
      
      const registerData = await registerResponse.json()
      
      if (registerData.success) {
        toast({
          title: "URLs Registered Successfully",
          description: "C2B Validation and Confirmation URLs have been registered with M-Pesa",
        })
      } else {
        throw new Error(registerData.error || 'Failed to register URLs')
      }
    } catch (error: any) {
      console.error('Error registering C2B URLs:', error)
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to register C2B URLs. Please check your credentials and try again.",
        variant: "destructive",
      })
    } finally {
      setRegisteringUrls(false)
    }
  }

  const saveMpesa = async () => {
    setSaving(true)
    try {
      // Validate required fields if enabled
      if (mpesaEnabled) {
        if (!consumerKey || !consumerSecret || !passkey || !shortcode) {
          toast({
            title: "Validation Error",
            description: "Consumer Key, Consumer Secret, Passkey, and Shortcode are required when M-Pesa is enabled",
            variant: "destructive",
          })
          setSaving(false)
          return
        }
      }

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin
      const defaultCallbackUrl = `${baseUrl}/api/mpesa/callback`
      const defaultValidationUrl = `${baseUrl}/api/c2b/validation`
      const defaultConfirmationUrl = `${baseUrl}/api/c2b/confirmation`

      const response = await fetch('/api/catha/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mpesa: {
            enabled: mpesaEnabled,
            environment: mpesaEnvironment,
            consumerKey,
            consumerSecret,
            passkey,
            shortcode,
            confirmationUrl: confirmationUrl || defaultConfirmationUrl,
            validationUrl: validationUrl || defaultValidationUrl,
            callbackUrl: callbackUrl || defaultCallbackUrl,
          },
        }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast({
          title: "Success",
          description: "M-Pesa settings saved successfully",
        })
      } else {
        throw new Error(data.error || 'Failed to save')
      }
    } catch (error: any) {
      console.error('Error saving M-Pesa settings:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to save M-Pesa settings",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const saveEtims = async () => {
    setSaving(true)
    try {
      // Validate required fields if enabled
      if (etimsEnabled) {
        if (!taxpayerPin || !branchOfficeId) {
          toast({
            title: "Validation Error",
            description: "Taxpayer PIN and Branch Office ID are required when eTIMS is enabled",
            variant: "destructive",
          })
          setSaving(false)
          return
        }
      }

      const response = await fetch('/api/catha/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          etims: {
            enabled: etimsEnabled,
            environment: etimsEnvironment,
            taxpayerPin,
            branchOfficeId,
            communicationKey,
            equipmentInfo,
          },
        }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast({
          title: "Success",
          description: "eTIMS settings saved successfully",
        })
      } else {
        throw new Error(data.error || 'Failed to save')
      }
    } catch (error: any) {
      console.error('Error saving eTIMS settings:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to save eTIMS settings",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const saveDelivery = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/catha/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delivery: {
            pickupAddress: pickupAddress.trim() || "Catha Lounge – Nairobi (exact address confirmed at order)",
            pickupDirectionsUrl: pickupDirectionsUrl.trim() || undefined,
            options: deliveryOptions,
          },
        }),
      })
      const data = await response.json()
      if (data.success) {
        sonnerToast.success("Saved")
      } else {
        sonnerToast.error("Failed to save delivery settings")
      }
    } catch (error: any) {
      console.error('Error saving delivery settings:', error)
      sonnerToast.error("Failed to save delivery settings")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <>
        <Header title="Settings" subtitle="Manage your POS system" />
        <div className="p-6">
          <div className="text-center py-12">Loading settings...</div>
        </div>
      </>
    )
  }

  return (
    <>
        <Header title="Settings" subtitle="Manage your POS system" />
        <div className="p-6">
          <Tabs defaultValue="general" className="space-y-6">
            <TabsList className="bg-secondary">
              <TabsTrigger value="general" className="gap-2">
                <Building className="h-4 w-4" />
                General
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-2">
                <Users className="h-4 w-4" />
                Users
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-2">
                <Bell className="h-4 w-4" />
                Notifications
              </TabsTrigger>
              <TabsTrigger value="security" className="gap-2">
                <Shield className="h-4 w-4" />
                Security
              </TabsTrigger>
              <TabsTrigger value="etims" className="gap-2">
                <Receipt className="h-4 w-4" />
                eTIMS
              </TabsTrigger>
              <TabsTrigger value="mpesa" className="gap-2">
                <Smartphone className="h-4 w-4" />
                M-Pesa
              </TabsTrigger>
              <TabsTrigger value="delivery" className="gap-2">
                <Truck className="h-4 w-4" />
                Delivery
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-card-foreground">Business Information</CardTitle>
                  <CardDescription>Update your bar's details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="businessName">Business Name</Label>
                      <Input 
                        id="businessName" 
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input 
                        id="phone" 
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input 
                      id="address" 
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <Select value={currency} onValueChange={setCurrency}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kes">KES (Ksh)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vat">VAT Rate (%)</Label>
                      <Input 
                        id="vat" 
                        type="number" 
                        value={vatRate}
                        onChange={(e) => setVatRate(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <Button onClick={saveBusinessInfo} disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-card-foreground">
                    <Printer className="h-5 w-5" />
                    Receipt Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-print receipts</Label>
                      <p className="text-sm text-muted-foreground">Print receipt after each sale</p>
                    </div>
                    <Switch checked={autoPrint} onCheckedChange={setAutoPrint} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Include VAT breakdown</Label>
                      <p className="text-sm text-muted-foreground">Show VAT details on receipt</p>
                    </div>
                    <Switch checked={includeVatBreakdown} onCheckedChange={setIncludeVatBreakdown} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Receipt footer message</Label>
                      <p className="text-sm text-muted-foreground">Custom message at bottom</p>
                    </div>
                    <Input 
                      className="w-64" 
                      value={footerMessage}
                      onChange={(e) => setFooterMessage(e.target.value)}
                    />
                  </div>
                  <Button onClick={saveReceiptSettings} disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              <Card className="border-border bg-card">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-card-foreground">User Management</CardTitle>
                    <CardDescription>Manage staff accounts and permissions</CardDescription>
                  </div>
                  <Button>Add User</Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {staff.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between rounded-lg border border-border p-4"
                      >
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12 border border-border">
                            <AvatarImage src={member.avatar || "/placeholder.svg"} />
                            <AvatarFallback className="bg-primary/20 text-primary">
                              {member.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-card-foreground">{member.name}</p>
                            <p className="text-sm text-muted-foreground capitalize">{member.role}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={member.role === "admin" ? "default" : "outline"}>{member.role}</Badge>
                          <Button variant="outline" size="sm">
                            Edit
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-6">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-card-foreground">Notification Preferences</CardTitle>
                  <CardDescription>Configure how you receive alerts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Low stock alerts</Label>
                      <p className="text-sm text-muted-foreground">Get notified when items are running low</p>
                    </div>
                    <Switch checked={lowStockAlerts} onCheckedChange={setLowStockAlerts} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Daily sales summary</Label>
                      <p className="text-sm text-muted-foreground">Receive end-of-day sales report</p>
                    </div>
                    <Switch checked={dailySalesSummary} onCheckedChange={setDailySalesSummary} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>New order notifications</Label>
                      <p className="text-sm text-muted-foreground">Sound alert for new orders</p>
                    </div>
                    <Switch checked={newOrderNotifications} onCheckedChange={setNewOrderNotifications} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Supplier delivery reminders</Label>
                      <p className="text-sm text-muted-foreground">Remind about scheduled deliveries</p>
                    </div>
                    <Switch checked={supplierDeliveryReminders} onCheckedChange={setSupplierDeliveryReminders} />
                  </div>
                  <Button onClick={saveNotifications} disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-card-foreground">Security Settings</CardTitle>
                  <CardDescription>Protect your POS system</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Require PIN for voids</Label>
                      <p className="text-sm text-muted-foreground">Manager PIN required to void transactions</p>
                    </div>
                    <Switch checked={requirePinForVoids} onCheckedChange={setRequirePinForVoids} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-logout</Label>
                      <p className="text-sm text-muted-foreground">Logout after inactivity</p>
                    </div>
                    <Select value={autoLogout} onValueChange={setAutoLogout}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 minutes</SelectItem>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="never">Never</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Two-factor authentication</Label>
                      <p className="text-sm text-muted-foreground">Extra security for admin accounts</p>
                    </div>
                    <Switch checked={twoFactorAuth} onCheckedChange={setTwoFactorAuth} />
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Change Admin Password</Label>
                    <div className="flex gap-3">
                      <Input type="password" placeholder="Current password" className="flex-1" />
                      <Input type="password" placeholder="New password" className="flex-1" />
                      <Button variant="outline">Update</Button>
                    </div>
                  </div>
                  <Button onClick={saveSecurity} disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="etims" className="space-y-6">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-card-foreground">KRA eTIMS OSCU Configuration</CardTitle>
                  <CardDescription>
                    Configure your On-Site Communication Unit (OSCU) for KRA eTIMS integration
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable eTIMS Integration</Label>
                      <p className="text-sm text-muted-foreground">Enable KRA eTIMS OSCU integration</p>
                    </div>
                    <Switch checked={etimsEnabled} onCheckedChange={setEtimsEnabled} />
                  </div>
                  <Separator />
                  
                  {etimsEnabled && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="etimsEnvironment">Environment</Label>
                        <Select value={etimsEnvironment} onValueChange={(value: 'sandbox' | 'production') => setEtimsEnvironment(value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                            <SelectItem value="production">Production</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {etimsEnvironment === 'sandbox' 
                            ? 'Sandbox URL: https://etims-api-sbx.kra.go.ke'
                            : 'Production URL: https://etims-api.kra.go.ke'}
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="taxpayerPin">Taxpayer PIN *</Label>
                          <Input 
                            id="taxpayerPin" 
                            type="text"
                            value={taxpayerPin}
                            onChange={(e) => setTaxpayerPin(e.target.value)}
                            placeholder="Enter your KRA Taxpayer PIN"
                          />
                          <p className="text-xs text-muted-foreground">Required for OSCU initialization</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="branchOfficeId">Branch Office ID *</Label>
                          <Input 
                            id="branchOfficeId" 
                            type="text"
                            value={branchOfficeId}
                            onChange={(e) => setBranchOfficeId(e.target.value)}
                            placeholder="Enter Branch Office ID"
                          />
                          <p className="text-xs text-muted-foreground">Required for OSCU initialization</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="communicationKey">Communication Key</Label>
                        <Input 
                          id="communicationKey" 
                          type="password"
                          value={communicationKey}
                          onChange={(e) => setCommunicationKey(e.target.value)}
                          placeholder="Retrieved from KRA after OSCU initialization"
                        />
                        <p className="text-xs text-muted-foreground">
                          This key is retrieved from KRA servers after successful OSCU initialization
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="equipmentInfo">Equipment Information</Label>
                        <Input 
                          id="equipmentInfo" 
                          type="text"
                          value={equipmentInfo}
                          onChange={(e) => setEquipmentInfo(e.target.value)}
                          placeholder="Optional: Equipment details for OSCU initialization"
                        />
                        <p className="text-xs text-muted-foreground">
                          Optional equipment information for OSCU device activation
                        </p>
                      </div>
                      
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                        <p className="text-sm font-semibold text-blue-900">OSCU Initialization Process:</p>
                        <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                          <li>Enter your Taxpayer PIN and Branch Office ID</li>
                          <li>Click "Initialize OSCU" to activate the device</li>
                          <li>The Communication Key will be retrieved automatically from KRA servers</li>
                          <li>Save the settings to store the credentials securely</li>
                        </ol>
                      </div>
                      
                      <div className="flex gap-3">
                        <Button 
                          onClick={saveEtims} 
                          disabled={saving}
                          className="flex-1"
                        >
                          {saving ? "Saving..." : "Save Settings"}
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={async () => {
                            if (!taxpayerPin || !branchOfficeId) {
                              toast({
                                title: "Validation Error",
                                description: "Please enter Taxpayer PIN and Branch Office ID first",
                                variant: "destructive",
                              })
                              return
                            }
                            
                            try {
                              setSaving(true)
                              const response = await fetch('/api/catha/etims/initialize', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  taxpayerPin,
                                  branchOfficeId,
                                  equipmentInfo: equipmentInfo || undefined,
                                  environment: etimsEnvironment,
                                }),
                              })
                              
                              const data = await response.json()
                              
                              if (data.success) {
                                if (data.communicationKey) {
                                  setCommunicationKey(data.communicationKey)
                                  toast({
                                    title: "OSCU Initialized Successfully",
                                    description: "Communication Key retrieved and saved",
                                  })
                                } else {
                                  toast({
                                    title: "Initialization Started",
                                    description: data.message || "OSCU initialization process initiated",
                                  })
                                }
                              } else {
                                throw new Error(data.error || 'Failed to initialize OSCU')
                              }
                            } catch (error: any) {
                              console.error('Error initializing OSCU:', error)
                              toast({
                                title: "Initialization Failed",
                                description: error.message || "Failed to initialize OSCU. Please check your credentials.",
                                variant: "destructive",
                              })
                            } finally {
                              setSaving(false)
                            }
                          }}
                          disabled={saving || !taxpayerPin || !branchOfficeId}
                        >
                          Initialize OSCU
                        </Button>
                      </div>
                    </>
                  )}
                  
                  {!etimsEnabled && (
                    <div className="bg-muted/50 border border-border rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">
                        Enable eTIMS integration to configure OSCU settings for KRA tax compliance.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="mpesa" className="space-y-6">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-card-foreground">M-Pesa Payment Gateway Configuration</CardTitle>
                  <CardDescription>
                    Configure M-Pesa STK Push and C2B payment integration
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable M-Pesa Gateway</Label>
                      <p className="text-sm text-muted-foreground">Enable M-Pesa payment processing</p>
                    </div>
                    <Switch checked={mpesaEnabled} onCheckedChange={setMpesaEnabled} />
                  </div>
                  <Separator />
                  
                  {mpesaEnabled && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="mpesaEnvironment">Environment</Label>
                        <Select value={mpesaEnvironment} onValueChange={(value: 'sandbox' | 'production') => setMpesaEnvironment(value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                            <SelectItem value="production">Production</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {mpesaEnvironment === 'sandbox' 
                            ? 'Sandbox URL: https://sandbox.safaricom.co.ke'
                            : 'Production URL: https://api.safaricom.co.ke'}
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="consumerKey">Consumer Key *</Label>
                          <Input 
                            id="consumerKey" 
                            type="text"
                            value={consumerKey}
                            onChange={(e) => setConsumerKey(e.target.value)}
                            placeholder="Enter M-Pesa Consumer Key"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="consumerSecret">Consumer Secret *</Label>
                          <Input 
                            id="consumerSecret" 
                            type="password"
                            value={consumerSecret}
                            onChange={(e) => setConsumerSecret(e.target.value)}
                            placeholder="Enter M-Pesa Consumer Secret"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="passkey">Passkey *</Label>
                          <Input 
                            id="passkey" 
                            type="password"
                            value={passkey}
                            onChange={(e) => setPasskey(e.target.value)}
                            placeholder="Enter M-Pesa Passkey"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="shortcode">Shortcode (Paybill/Till) *</Label>
                          <Input 
                            id="shortcode" 
                            type="text"
                            value={shortcode}
                            onChange={(e) => setShortcode(e.target.value)}
                            placeholder="Enter Shortcode"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="callbackUrl">STK Push Callback URL</Label>
                        <Input 
                          id="callbackUrl" 
                          type="url"
                          value={callbackUrl}
                          onChange={(e) => setCallbackUrl(e.target.value)}
                          placeholder="https://yourdomain.com/api/mpesa/callback"
                        />
                        <p className="text-xs text-muted-foreground">
                          URL where M-Pesa sends STK Push payment callbacks
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="validationUrl">C2B Validation URL</Label>
                        <Input 
                          id="validationUrl" 
                          type="url"
                          value={validationUrl}
                          onChange={(e) => setValidationUrl(e.target.value)}
                          placeholder="https://yourdomain.com/api/c2b/validation"
                        />
                        <p className="text-xs text-muted-foreground">
                          URL where M-Pesa sends C2B validation requests
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="confirmationUrl">C2B Confirmation URL</Label>
                        <Input 
                          id="confirmationUrl" 
                          type="url"
                          value={confirmationUrl}
                          onChange={(e) => setConfirmationUrl(e.target.value)}
                          placeholder="https://yourdomain.com/api/c2b/confirmation"
                        />
                        <p className="text-xs text-muted-foreground">
                          URL where M-Pesa sends C2B confirmation requests
                        </p>
                      </div>
                      
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                        <p className="text-sm font-semibold text-blue-900">M-Pesa Integration Notes:</p>
                        <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                          <li>STK Push is used for customer-initiated payments from POS</li>
                          <li>C2B handles direct payments to your Paybill/Till number</li>
                          <li>Ensure your URLs are publicly accessible (not localhost in production)</li>
                          <li>Register C2B URLs after saving settings to activate C2B payments</li>
                        </ul>
                      </div>
                      
                      <div className="flex gap-3">
                        <Button 
                          onClick={saveMpesa} 
                          disabled={saving}
                          className="flex-1"
                        >
                          {saving ? "Saving..." : "Save M-Pesa Settings"}
                        </Button>
                        <Button 
                          onClick={registerC2BUrls} 
                          disabled={registeringUrls || saving || !mpesaEnabled || !consumerKey || !consumerSecret || !passkey || !shortcode}
                          variant="outline"
                          className="flex-1"
                        >
                          {registeringUrls ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Registering...
                            </span>
                          ) : (
                            "Register C2B URLs"
                          )}
                        </Button>
                      </div>
                    </>
                  )}
                  
                  {!mpesaEnabled && (
                    <div className="bg-muted/50 border border-border rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">
                        Enable M-Pesa integration to configure payment gateway settings.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="delivery" className="space-y-6">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-card-foreground flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    E-commerce Delivery & Pickup
                  </CardTitle>
                  <CardDescription>
                    Configure delivery options and pickup address shown at checkout. These appear as selectable cards on the checkout page.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="pickupAddress">Pickup Address (Collect at Catha Lounge)</Label>
                    <Input
                      id="pickupAddress"
                      value={pickupAddress}
                      onChange={(e) => setPickupAddress(e.target.value)}
                      placeholder="e.g. Catha Lounge – Westlands, Nairobi"
                    />
                    <p className="text-xs text-muted-foreground">
                      Shown to customers when they choose &quot;Collect at Catha Lounge&quot;. Include exact address or &quot;exact address confirmed at order&quot;.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pickupDirectionsUrl">Directions link</Label>
                    <Input
                      id="pickupDirectionsUrl"
                      type="url"
                      value={pickupDirectionsUrl}
                      onChange={(e) => setPickupDirectionsUrl(e.target.value)}
                      placeholder="https://maps.google.com/... or https://goo.gl/maps/..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional. Add a Google Maps (or other) link so customers can open directions to Catha Lounge at checkout.
                    </p>
                  </div>

                  <Separator />

                  <div>
                    <Label className="text-card-foreground font-semibold">Delivery options</Label>
                    <p className="text-sm text-muted-foreground mb-4">
                      Edit label, fee (KES), and subtext for each option. Disabled options are hidden at checkout.
                    </p>
                    <div className="space-y-4">
                      {deliveryOptions.map((opt, index) => (
                        <div
                          key={opt.value}
                          className="rounded-lg border border-border p-4 space-y-3 bg-muted/20"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                              {opt.value === 'collect_at_catha_lodge' ? (
                                <Store className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="font-medium text-sm text-muted-foreground">{opt.value}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`opt-enabled-${index}`} className="text-sm">Show at checkout</Label>
                              <Switch
                                id={`opt-enabled-${index}`}
                                checked={opt.enabled}
                                onCheckedChange={(checked) => {
                                  setDeliveryOptions((prev) =>
                                    prev.map((o, i) => (i === index ? { ...o, enabled: !!checked } : o))
                                  )
                                }}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label>Label</Label>
                              <Input
                                value={opt.label}
                                onChange={(e) =>
                                  setDeliveryOptions((prev) =>
                                    prev.map((o, i) => (i === index ? { ...o, label: e.target.value } : o))
                                  )
                                }
                                placeholder="e.g. Deliver to My Location"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Fee (KES)</Label>
                              <Input
                                type="number"
                                min={0}
                                value={opt.fee}
                                onChange={(e) =>
                                  setDeliveryOptions((prev) =>
                                    prev.map((o, i) => (i === index ? { ...o, fee: Number(e.target.value) || 0 } : o))
                                  )
                                }
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label>Subtext (shown under label)</Label>
                            <Input
                              value={opt.subtext}
                              onChange={(e) =>
                                setDeliveryOptions((prev) =>
                                  prev.map((o, i) => (i === index ? { ...o, subtext: e.target.value } : o))
                                )
                              }
                              placeholder="e.g. Delivery fee applies"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button onClick={saveDelivery} disabled={saving}>
                    {saving ? "Saving..." : "Save Delivery Settings"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
    </>
  )
}
