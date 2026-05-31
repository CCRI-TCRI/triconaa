"use client"

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
import { Settings, Shield, Palette, Database, Save, RefreshCw } from "lucide-react"

const DEFAULT_SETTINGS: ElectionSettings = {
  election_name: "2025 Prefectorial Elections",
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
  { value: "default", label: "Default" },
  { value: "halloween", label: "Halloween" },
  { value: "christmas", label: "Christmas" },
  { value: "july4th", label: "July 4th" },
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

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>

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
