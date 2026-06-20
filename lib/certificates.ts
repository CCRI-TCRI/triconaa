// Formal winner certificate PDF generator (one landscape page per winner).

async function toDataUrl(url?: string | null): Promise<string | null> {
  if (!url) return null
  if (url.startsWith("data:")) return url
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result as string)
      fr.onerror = reject
      fr.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export interface WinnerCert {
  position: string
  name: string
}

export async function downloadWinnerCertificates(opts: {
  winners: WinnerCert[]
  schoolName: string
  motto: string
  term?: string
  logoUrl?: string | null
  certifiedChair?: string | null
  certifiedHead?: string | null
  certifiedAt?: string | null
}): Promise<void> {
  const { winners, schoolName, motto, term, logoUrl, certifiedChair, certifiedHead, certifiedAt } = opts
  if (winners.length === 0) return
  const { jsPDF } = await import("jspdf")
  const doc: any = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const gold: [number, number, number] = [197, 160, 40]
  const ink: [number, number, number] = [30, 41, 59]
  const maroon: [number, number, number] = [22, 138, 173]
  const logo = await toDataUrl(logoUrl)
  const dateStr = (certifiedAt ? new Date(certifiedAt) : new Date()).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })

  winners.forEach((w, i) => {
    if (i > 0) doc.addPage()
    // ornate double border
    doc.setDrawColor(...gold); doc.setLineWidth(6); doc.rect(22, 22, W - 44, H - 44)
    doc.setDrawColor(...maroon); doc.setLineWidth(1.5); doc.rect(33, 33, W - 66, H - 66)

    if (logo) {
      try { doc.addImage(logo, "PNG", W / 2 - 28, 52, 56, 56) } catch { /* ignore */ }
    }
    doc.setTextColor(...ink)
    doc.setFont("times", "bold"); doc.setFontSize(22)
    doc.text(schoolName.toUpperCase(), W / 2, 132, { align: "center" })
    doc.setFont("times", "italic"); doc.setFontSize(11); doc.setTextColor(...maroon)
    doc.text(`"${motto}"`, W / 2, 152, { align: "center" })

    doc.setTextColor(...gold); doc.setFont("times", "bold"); doc.setFontSize(30)
    doc.text("CERTIFICATE OF ELECTION", W / 2, 200, { align: "center" })

    doc.setTextColor(...ink); doc.setFont("times", "normal"); doc.setFontSize(13)
    doc.text("This is to certify that", W / 2, 248, { align: "center" })

    doc.setFont("times", "bold"); doc.setFontSize(34); doc.setTextColor(...maroon)
    doc.text(w.name, W / 2, 296, { align: "center" })

    doc.setTextColor(...ink); doc.setFont("times", "normal"); doc.setFontSize(13)
    doc.text("has been duly elected to the office of", W / 2, 332, { align: "center" })
    doc.setFont("times", "bold"); doc.setFontSize(20); doc.setTextColor(...gold)
    doc.text(w.position.toUpperCase(), W / 2, 364, { align: "center" })

    if (term) {
      doc.setTextColor(...ink); doc.setFont("times", "italic"); doc.setFontSize(11)
      doc.text(`for the ${term}`, W / 2, 388, { align: "center" })
    }

    // signature lines
    const y = H - 96
    const lx = W * 0.28, rx = W * 0.72
    doc.setDrawColor(...ink); doc.setLineWidth(1)
    doc.line(lx - 90, y, lx + 90, y)
    doc.line(rx - 90, y, rx + 90, y)
    doc.setFont("times", "bold"); doc.setFontSize(11); doc.setTextColor(...ink)
    doc.text(certifiedChair || "Electoral Commission", lx, y + 16, { align: "center" })
    doc.text(certifiedHead || "Head Teacher", rx, y + 16, { align: "center" })
    doc.setFont("times", "normal"); doc.setFontSize(9); doc.setTextColor(120, 120, 120)
    doc.text("Chairperson, Electoral Commission", lx, y + 30, { align: "center" })
    doc.text("Head Teacher", rx, y + 30, { align: "center" })
    doc.text(`Issued: ${dateStr}`, W / 2, H - 44, { align: "center" })
  })

  doc.save(`winner-certificates-${new Date().toISOString().split("T")[0]}.pdf`)
}
