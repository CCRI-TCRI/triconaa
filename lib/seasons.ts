export interface Season {
  theme: string
  greeting: string
  icon: string
  colors: {
    primary: string
    secondary: string
    accent: string
  }
  isActive: boolean
}

export function getCurrentSeason(): Season {
  const now = new Date()
  const month = now.getMonth() + 1 // getMonth() returns 0-11
  const day = now.getDate()

  // Fourth of July (July 4th)
  if (month === 7 && day === 4) {
    return {
      theme: "fourth-of-july",
      greeting: "Happy Independence Day! Celebrate freedom and democracy!",
      icon: "🇺🇸",
      colors: {
        primary: "#B91C1C", // red-700
        secondary: "#1E40AF", // blue-700
        accent: "#FFFFFF", // white
      },
      isActive: true,
    }
  }

  // Halloween (October 31st)
  if (month === 10 && day === 31) {
    return {
      theme: "halloween",
      greeting: "Happy Halloween! Spooky voting awaits!",
      icon: "🎃",
      colors: {
        primary: "#EA580C", // orange-600
        secondary: "#7C2D12", // orange-900
        accent: "#A855F7", // purple-500
      },
      isActive: true,
    }
  }

  // Christmas (December 25th)
  if (month === 12 && day === 25) {
    return {
      theme: "christmas",
      greeting: "Merry Christmas! Season of giving and voting!",
      icon: "🎄",
      colors: {
        primary: "#DC2626", // red-600
        secondary: "#16A34A", // green-600
        accent: "#FCD34D", // yellow-300
      },
      isActive: true,
    }
  }

  // New Year's Day (January 1st)
  if (month === 1 && day === 1) {
    return {
      theme: "newyear",
      greeting: "Happy New Year! New year, new leaders!",
      icon: "🎊",
      colors: {
        primary: "#7C3AED", // violet-600
        secondary: "#F59E0B", // amber-500
        accent: "#EC4899", // pink-500
      },
      isActive: true,
    }
  }

  // Valentine's Day (February 14th)
  if (month === 2 && day === 14) {
    return {
      theme: "valentine",
      greeting: "Happy Valentine's Day! Vote with love!",
      icon: "💝",
      colors: {
        primary: "#EC4899", // pink-500
        secondary: "#DC2626", // red-600
        accent: "#FBBF24", // amber-400
      },
      isActive: true,
    }
  }

  // Pride Month (June)
  if (month === 6) {
    return {
      theme: "pride",
      greeting: "Happy Pride Month! Celebrate diversity and inclusion!",
      icon: "🏳️‍🌈",
      colors: {
        primary: "#DC2626", // red-600
        secondary: "#7C3AED", // violet-600
        accent: "#F59E0B", // amber-500
      },
      isActive: true,
    }
  }

  // Default theme
  return {
    theme: "default",
    greeting: "Welcome to the voting system!",
    icon: "🗳️",
    colors: {
      primary: "#3B82F6", // blue-500
      secondary: "#8B5CF6", // violet-500
      accent: "#10B981", // emerald-500
    },
    isActive: false,
  }
}

export function getSeasonalContainerClass(theme: string): string {
  switch (theme) {
    case "fourth-of-july":
      return "bg-gradient-to-br from-red-700 via-blue-700 to-red-800"
    case "halloween":
      return "bg-gradient-to-br from-orange-900 via-black to-purple-900"
    case "christmas":
      return "bg-gradient-to-br from-red-900 via-green-900 to-red-800"
    case "newyear":
      return "bg-gradient-to-br from-purple-900 via-blue-900 to-yellow-900"
    case "valentine":
      return "bg-gradient-to-br from-pink-900 via-red-900 to-pink-800"
    case "pride":
      return "bg-gradient-to-br from-red-500 via-yellow-500 via-green-500 via-blue-500 via-indigo-500 to-purple-500"
    default:
      return "bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900"
  }
}
