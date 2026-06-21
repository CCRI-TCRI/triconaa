"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import type { ElectionSettings } from "@/lib/supabase"
import { BRANDING_UPDATED_EVENT, DEFAULT_BRANDING } from "@/components/school-branding-provider"
import { ThemeToggle } from "@/components/theme-toggle"
import { Settings, Shield, Palette, Database, Save, RefreshCw, School, Upload, Trash2, ImageIcon } from "lucide-react"

const DEFAULT_SETTINGS: ElectionSettings = {
  election_name: "2025 Prefectorial Elections",
  school_name: DEFAULT_BRANDING.schoolName,
  school_motto: DEFAULT_BRANDING.motto,
  logo_url: null,
  start_date: new Date().toISOString().split("T")[0],
  end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  is_active: true,
  allow_face_recognition: false,
  require_biometric: false,
  max_votes_per_user: 1,
  show_results_live: false,
  enable_tutorial: true,
  seasonal_theme: "default",
  custom_greeting: "",
  holiday_popups_enabled: true,
}

const seasonalThemes = [
  { value: "auto", label: "Automatic (by date)" },
  { value: "default", label: "Default (Blue)" },
  { value: "halloween", label: "Halloween" },
  { value: "christmas", label: "Christmas" },
  { value: "newyear", label: "New Year" },
  { value: "fourth-of-july", label: "Independence Day" },
  { value: "valentine", label: "Valentine's Day" },
  { value: "pride", label: "Pride Month" },
]

export default function SettingsPage() {
  const [settings, setSettings] = useState<ElectionSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dbStatus, setDbStatus] = useState<"connected" | "disconnected" | "checking">("checking")

  useEffect(() => {
    fetchSettings()
    checkDatabaseStatus()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.from("election_settings").select("*").single()
      if (error && error.code !== "PGRST116") {
        console.error("Settings fetch error:", error)
        setSettings(DEFAULT_SETTINGS)
      } else if (data) {
        setSettings(data)
      } else {
        await createDefaultSettings()
      }
    } catch (error) {
      console.error("Error fetching settings:", error)
      setSettings(DEFAULT_SETTINGS)
    } finally {
      setLoading(false)
    }
  }

  const createDefaultSettings = async () => {
    const { data, error } = await supabase.from("election_settings").insert([DEFAULT_SETTINGS]).select().single()
    if (!error && data) setSettings(data)
  }

  const checkDatabaseStatus = async () => {
    try {
      const { error } = await supabase.from("users").select("id").limit(1)
      setDbStatus(error ? "disconnected" : "connected")
    } catch {
      setDbStatus("disconnected")
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      if (settings.id) {
        const { error } = await supabase.from("election_settings").update(settings).eq("id", settings.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from("election_settings").insert([settings]).select().single()
        if (error) throw error
        if (data) setSettings(data)
      }
      // Notify the rest of the site so name/logo update live
      if (typeof window !== "undefined") window.dispatchEvent(new Event(BRANDING_UPDATED_EVENT))
      toast({ title: "Success", description: "Settings saved successfully" })
    } catch (error: any) {
      console.error("Error saving settings:", error)
      toast({ title: "Error", description: error.message || "Failed to save settings", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const resetToDefaults = () => {
    setSettings(DEFAULT_SETTINGS)
    toast({ title: "Reset", description: "Settings reset to defaults" })
  }

  const updateSetting = (key: keyof ElectionSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  // Resize an uploaded image to a small square-ish PNG data URL (kept in the DB)
  const resizeImage = (file: File, max = 256, mime: string = "image/png", quality = 0.92): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const img = new window.Image()
        img.onload = () => {
          let { width, height } = img
          if (width > height && width > max) {
            height = Math.round((height * max) / width)
            width = max
          } else if (height > max) {
            width = Math.round((width * max) / height)
            height = max
          }
          const canvas = document.createElement("canvas")
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext("2d")
          if (!ctx) return reject(new Error("no canvas context"))
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL(mime, quality))
        }
        img.onerror = reject
        img.src = reader.result as string
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please choose an image file.", variant: "destructive" })
      return
    }
    try {
      const dataUrl = await resizeImage(file, 256)
      updateSetting("logo_url", dataUrl)
      toast({ title: "Logo ready", description: "Click Save Settings to apply it across the site." })
    } catch {
      toast({ title: "Error", description: "Could not process that image.", variant: "destructive" })
    } finally {
      e.target.value = ""
    }
  }

  const removeLogo = () => updateSetting("logo_url", null)

  // ── Voter login background (slideshow images + optional video) ──
  const loginImages: string[] = (() => {
    try {
      const arr = JSON.parse(settings.login_bg_images || "[]")
      return Array.isArray(arr) ? arr : []
    } catch {
      return []
    }
  })()

  const setLoginImages = (arr: string[]) => updateSetting("login_bg_images", JSON.stringify(arr))

  const handleLoginImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please choose an image file.", variant: "destructive" })
      return
    }
    if (loginImages.length >= 4) {
      toast({ title: "Limit reached", description: "You can add up to 4 photos.", variant: "destructive" })
      return
    }
    try {
      const dataUrl = await resizeImage(file, 1600, "image/jpeg", 0.72)
      setLoginImages([...loginImages, dataUrl])
    } catch {
      toast({ title: "Error", description: "Could not process that image.", variant: "destructive" })
    } finally {
      e.target.value = ""
    }
  }

  const removeLoginImage = (i: number) => setLoginImages(loginImages.filter((_, idx) => idx !== i))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Election Settings</h1>
          <p className="text-muted-foreground">Configure election parameters and system settings</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={resetToDefaults} variant="outline" disabled={saving}>
            <RefreshCw className="w-4 h-4 mr-2" />Reset to Defaults
          </Button>
          <Button onClick={saveSettings} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />{saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Palette className="w-5 h-5" />Appearance</CardTitle>
          <CardDescription>Switch the whole site between light and dark instantly.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4 dark:border-white/10">
            <div>
              <p className="font-medium">Theme</p>
              <p className="text-sm text-muted-foreground">Light / dark mode — applies immediately, no reload.</p>
            </div>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      {/* Database Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="w-5 h-5" />Database Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${dbStatus === "connected" ? "bg-green-500" : dbStatus === "disconnected" ? "bg-red-500" : "bg-yellow-500 animate-pulse"}`} />
            <span className="font-medium">
              {dbStatus === "connected" ? "Connected to Supabase" : dbStatus === "disconnected" ? "Disconnected" : "Checking connection..."}
            </span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="school" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="school">School</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>

        <TabsContent value="school" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <School className="w-5 h-5 text-rose-700" />
                School Identity
              </CardTitle>
              <CardDescription>
                Set the name, motto and logo of the school holding this election. These appear across the entire
                site — the voter login, ballot, dashboard, live results and PDF reports.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-white shadow">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={settings.logo_url || DEFAULT_BRANDING.logoUrl}
                    alt="School logo preview"
                    className="h-20 w-20 object-contain"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    School Logo
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    <label className="cursor-pointer">
                      <div className="inline-flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800 transition hover:bg-rose-100">
                        <Upload className="h-4 w-4" />
                        Upload Logo
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    </label>
                    {settings.logo_url && (
                      <Button variant="outline" size="sm" onClick={removeLogo} className="text-red-600">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PNG or JPG. The image is resized automatically. Remove to fall back to the default logo.
                  </p>
                </div>
              </div>

              {/* Name + motto */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="school_name">School Name</Label>
                  <Input
                    id="school_name"
                    value={settings.school_name || ""}
                    onChange={(e) => updateSetting("school_name", e.target.value)}
                    placeholder="e.g. St. Theresa S.S. Buloba-Kasero"
                  />
                </div>
                <div>
                  <Label htmlFor="school_motto">School Motto</Label>
                  <Input
                    id="school_motto"
                    value={settings.school_motto || ""}
                    onChange={(e) => updateSetting("school_motto", e.target.value)}
                    placeholder="e.g. Mercy Upon Us"
                  />
                </div>
              </div>

              {/* Live preview */}
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Preview</Label>
                <div className="mt-1.5 flex items-center gap-3 rounded-xl bg-gradient-to-r from-[#5c0f1f] to-[#7a1f2b] p-4 text-white">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={settings.logo_url || DEFAULT_BRANDING.logoUrl}
                      alt="preview"
                      className="h-10 w-10 object-contain"
                    />
                  </div>
                  <div>
                    <p className="font-bold leading-tight">{settings.school_name || DEFAULT_BRANDING.schoolName}</p>
                    <p className="text-xs italic text-amber-200/90">
                      "{settings.school_motto || DEFAULT_BRANDING.motto}"
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-amber-700">
                  Remember to click <strong>Save Settings</strong> (top right) to apply changes site-wide.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-rose-700" />
                Voter Login Background
              </CardTitle>
              <CardDescription>
                Customise the background of the voter login page with up to 4 photos (a slideshow) or a background video.
                A video, if set, takes priority over the photos. Leave both empty for the plain dark background.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Slideshow photos */}
              <div>
                <Label>Slideshow Photos ({loginImages.length}/4)</Label>
                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {loginImages.map((src, i) => (
                    <div key={i} className="group relative aspect-video overflow-hidden rounded-lg border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`Login background ${i + 1}`} className="h-full w-full object-cover" />
                      <button
                        onClick={() => removeLoginImage(i)}
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                        aria-label="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {loginImages.length < 4 && (
                    <label className="flex aspect-video cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-rose-200 bg-rose-50/50 text-rose-700 transition hover:border-rose-400 hover:bg-rose-50">
                      <Upload className="h-5 w-5" />
                      <span className="text-xs font-medium">Add photo</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleLoginImageUpload} />
                    </label>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Photos are resized automatically and crossfade every few seconds on the login page.
                </p>
              </div>

              {/* Background video */}
              <div>
                <Label htmlFor="login_video">Background Video URL (optional)</Label>
                <Input
                  id="login_video"
                  value={settings.login_bg_video || ""}
                  onChange={(e) => updateSetting("login_bg_video", e.target.value)}
                  placeholder="https://…/background.mp4"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Paste a direct link to an .mp4/.webm video. It plays muted and looped behind the login. Clear it to use the photo slideshow instead.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5" />General Settings</CardTitle>
              <CardDescription>Basic election configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="election_name">Election Name</Label>
                <Input id="election_name" value={settings.election_name} onChange={(e) => updateSetting("election_name", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input id="start_date" type="date" value={settings.start_date} onChange={(e) => updateSetting("start_date", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="end_date">End Date</Label>
                  <Input id="end_date" type="date" value={settings.end_date} onChange={(e) => updateSetting("end_date", e.target.value)} />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="is_active" checked={settings.is_active} onCheckedChange={(checked) => updateSetting("is_active", checked)} />
                <Label htmlFor="is_active">Election is Active</Label>
              </div>
              <div>
                <Label htmlFor="max_votes">Maximum Votes per User</Label>
                <Select value={settings.max_votes_per_user.toString()} onValueChange={(value) => updateSetting("max_votes_per_user", parseInt(value))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 5].map((n) => <SelectItem key={n} value={n.toString()}>{n} Vote{n > 1 ? "s" : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5" />Security Settings</CardTitle>
              <CardDescription>Authentication and security options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch id="allow_face_recognition" checked={settings.allow_face_recognition} onCheckedChange={(checked) => updateSetting("allow_face_recognition", checked)} />
                <Label htmlFor="allow_face_recognition">Enable Face Recognition</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="require_biometric" checked={settings.require_biometric} onCheckedChange={(checked) => updateSetting("require_biometric", checked)} />
                <Label htmlFor="require_biometric">Require Biometric Authentication</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Palette className="w-5 h-5" />Appearance Settings</CardTitle>
              <CardDescription>Customize the look and feel</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="seasonal_theme">Seasonal Theme</Label>
                <Select value={settings.seasonal_theme} onValueChange={(value) => updateSetting("seasonal_theme", value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{seasonalThemes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Controls the voter-facing background, intro animation and holiday greeting across the site.
                  Choose <strong>Automatic</strong> to switch themes by calendar date. Save to apply.
                </p>
              </div>
              <div>
                <Label htmlFor="custom_greeting">Custom Greeting Message</Label>
                <Textarea id="custom_greeting" value={settings.custom_greeting} onChange={(e) => updateSetting("custom_greeting", e.target.value)} placeholder="Enter a custom greeting..." rows={3} />
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="holiday_popups" checked={settings.holiday_popups_enabled} onCheckedChange={(checked) => updateSetting("holiday_popups_enabled", checked)} />
                <Label htmlFor="holiday_popups">Enable Holiday Popups</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Feature Settings</CardTitle>
              <CardDescription>Enable or disable specific features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch id="show_results_live" checked={settings.show_results_live} onCheckedChange={(checked) => updateSetting("show_results_live", checked)} />
                <Label htmlFor="show_results_live">Show Live Results</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="enable_tutorial" checked={settings.enable_tutorial} onCheckedChange={(checked) => updateSetting("enable_tutorial", checked)} />
                <Label htmlFor="enable_tutorial">Enable Tutorial for New Users</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
