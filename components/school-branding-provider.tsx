"use client"

import { createContext, useContext, useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export interface SchoolBranding {
  schoolName: string
  motto: string
  logoUrl: string
  loading: boolean
  refresh: () => Promise<void>
}

// Site-wide defaults (used until the database value loads, or if it is unset)
export const DEFAULT_BRANDING = {
  schoolName: "St. Theresa S.S. Buloba-Kasero",
  motto: "Mercy Upon Us",
  logoUrl: "/logo.png",
}

const BrandingContext = createContext<SchoolBranding>({
  ...DEFAULT_BRANDING,
  loading: true,
  refresh: async () => {},
})

export const BRANDING_UPDATED_EVENT = "school-branding-updated"

export function SchoolBrandingProvider({ children }: { children: React.ReactNode }) {
  const [schoolName, setSchoolName] = useState(DEFAULT_BRANDING.schoolName)
  const [motto, setMotto] = useState(DEFAULT_BRANDING.motto)
  const [logoUrl, setLogoUrl] = useState(DEFAULT_BRANDING.logoUrl)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("election_settings")
        .select("school_name, school_motto, logo_url")
        .limit(1)
        .single()
      if (data) {
        setSchoolName(data.school_name?.trim() || DEFAULT_BRANDING.schoolName)
        setMotto(data.school_motto?.trim() || DEFAULT_BRANDING.motto)
        setLogoUrl(data.logo_url?.trim() || DEFAULT_BRANDING.logoUrl)
      }
    } catch {
      // keep defaults
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    // Allow other pages (e.g. settings) to trigger a live refresh after saving
    const handler = () => refresh()
    window.addEventListener(BRANDING_UPDATED_EVENT, handler)
    return () => window.removeEventListener(BRANDING_UPDATED_EVENT, handler)
  }, [refresh])

  return (
    <BrandingContext.Provider value={{ schoolName, motto, logoUrl, loading, refresh }}>
      {children}
    </BrandingContext.Provider>
  )
}

export function useSchoolBranding() {
  return useContext(BrandingContext)
}
