"use client"

import { useState, useEffect } from "react"
import { getCurrentSeason, type Season } from "@/lib/seasons"

export function useSeasonalTheme() {
  const [season, setSeason] = useState<Season>(getCurrentSeason())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const updateSeason = () => {
      const currentSeason = getCurrentSeason()
      setSeason(currentSeason)
      setIsLoading(false)

      // Apply theme-specific body classes
      document.body.className = document.body.className.replace(/theme-\w+/g, "")
      document.body.classList.add(`theme-${currentSeason.theme}`)

      // Apply dark mode for certain themes
      if (currentSeason.theme === "halloween") {
        document.documentElement.classList.add("dark")
      } else {
        document.documentElement.classList.remove("dark")
      }
    }

    updateSeason()

    // Check for season changes every hour
    const interval = setInterval(updateSeason, 60 * 60 * 1000)

    return () => {
      clearInterval(interval)
      // Clean up theme classes
      document.body.className = document.body.className.replace(/theme-\w+/g, "")
    }
  }, [])

  const getThemeColors = () => {
    switch (season.theme) {
      case "christmas":
        return {
          primary: "from-red-600 to-green-600",
          secondary: "from-green-500 to-red-500",
          accent: "text-red-400",
        }
      case "halloween":
        return {
          primary: "from-orange-600 to-purple-600",
          secondary: "from-purple-500 to-orange-500",
          accent: "text-orange-400",
        }
      case "valentine":
        return {
          primary: "from-pink-600 to-red-600",
          secondary: "from-red-500 to-pink-500",
          accent: "text-pink-400",
        }
      case "easter":
        return {
          primary: "from-yellow-500 to-green-500",
          secondary: "from-green-400 to-yellow-400",
          accent: "text-yellow-400",
        }
      case "independence":
        return {
          primary: "from-red-600 via-white to-blue-600",
          secondary: "from-blue-500 to-red-500",
          accent: "text-blue-400",
        }
      default:
        return {
          primary: "from-blue-600 to-purple-600",
          secondary: "from-purple-500 to-blue-500",
          accent: "text-blue-400",
        }
    }
  }

  const getSeasonalMessage = () => {
    if (season.theme === "default") return null

    return {
      greeting: season.greeting,
      message: season.message,
      icon: season.icon,
    }
  }

  return {
    season,
    isLoading,
    themeColors: getThemeColors(),
    seasonalMessage: getSeasonalMessage(),
    isSpecialSeason: season.theme !== "default",
  }
}
