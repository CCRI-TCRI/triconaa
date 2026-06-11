/**
 * Extracts the dominant non-neutral colour from a logo image (data URL or URL).
 * Falls back to Meadow Green #168AAD if extraction fails.
 */
export async function extractLogoColor(
  logoUrl: string,
  fallback: [number, number, number] = [22, 138, 173],
): Promise<[number, number, number]> {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      try {
        const SIZE = 64
        const canvas = document.createElement("canvas")
        canvas.width = SIZE
        canvas.height = SIZE
        const ctx = canvas.getContext("2d")
        if (!ctx) return resolve(fallback)
        ctx.drawImage(img, 0, 0, SIZE, SIZE)
        const { data } = ctx.getImageData(0, 0, SIZE, SIZE)
        const buckets: Record<string, { r: number; g: number; b: number; count: number }> = {}
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3]
          if (a < 128) continue
          const r = data[i], g = data[i + 1], b = data[i + 2]
          const brightness = (r + g + b) / 3
          if (brightness > 230 || brightness < 20) continue
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
          const sat = mx === 0 ? 0 : (mx - mn) / mx
          if (sat < 0.15) continue
          const qr = Math.round(r / 24) * 24
          const qg = Math.round(g / 24) * 24
          const qb = Math.round(b / 24) * 24
          const key = `${qr},${qg},${qb}`
          if (!buckets[key]) buckets[key] = { r: qr, g: qg, b: qb, count: 0 }
          buckets[key].count++
        }
        const sorted = Object.values(buckets).sort((a, b) => b.count - a.count)
        if (!sorted.length) return resolve(fallback)
        const { r, g, b } = sorted[0]
        resolve([r, g, b])
      } catch {
        resolve(fallback)
      }
    }
    img.onerror = () => resolve(fallback)
    img.src = logoUrl
  })
}
