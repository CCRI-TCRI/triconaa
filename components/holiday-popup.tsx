"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Sparkles, Heart, Candy, PartyPopper, Flag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCurrentSeason } from "@/lib/seasons"

interface HolidayPopupProps {
  onClose: () => void
}

export function HolidayPopup({ onClose }: HolidayPopupProps) {
  const [isVisible, setIsVisible] = useState(true)
  const season = getCurrentSeason()

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 300)
  }

  const getHolidayContent = () => {
    switch (season.theme) {
      case "fourth-of-july":
        return {
          title: "Happy Independence Day! 🇺🇸",
          description:
            "Celebrating the birth of American democracy on July 4th, 1776. Today we commemorate the signing of the Declaration of Independence and the founding principles of freedom, liberty, and justice for all.",
          details: [
            "🗽 Declaration of Independence signed in 1776",
            "🎆 Traditional celebrations with fireworks and parades",
            "🇺🇸 A day to honor American freedom and democracy",
            "🗳️ Perfect time to exercise your democratic right to vote!",
          ],
          bgClass: "bg-gradient-to-br from-red-600 via-blue-600 to-red-700",
          icon: <Flag className="w-8 h-8" />,
          hasVideo: true,
          videoSrc: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/700_F_615676833_OkjRLHwlUrVvD6nYoOcr8CkViHeNnMAc_ST-vnvwEKsfM1KK0a3uhBAVNMkhrb7ZGb.mp4",
        }
      case "halloween":
        return {
          title: "Happy Halloween! 🎃",
          description:
            "A spooky celebration of costumes, candy, and fun! Halloween originated from ancient Celtic festivals and has become a beloved tradition of trick-or-treating and festive decorations.",
          details: [
            "🎃 Carved pumpkins and jack-o'-lanterns",
            "👻 Costumes and trick-or-treating traditions",
            "🍬 Sweet treats and spooky decorations",
            "🗳️ Even ghosts and goblins need good leaders!",
          ],
          bgClass: "bg-gradient-to-br from-orange-600 via-purple-700 to-orange-800",
          icon: <Candy className="w-8 h-8" />,
          hasVideo: false,
        }
      case "christmas":
        return {
          title: "Merry Christmas! 🎄",
          description:
            "A joyous celebration of giving, family, and peace on earth. Christmas commemorates the birth of Jesus Christ and has become a global celebration of love, generosity, and togetherness.",
          details: [
            "🎁 Season of giving and sharing joy",
            "🎄 Decorated trees and festive lights",
            "👨‍👩‍👧‍👦 Time for family gatherings and traditions",
            "🗳️ Choosing leaders who spread peace and goodwill!",
          ],
          bgClass: "bg-gradient-to-br from-red-600 via-green-700 to-red-700",
          icon: <Sparkles className="w-8 h-8" />,
          hasVideo: false,
        }
      case "newyear":
        return {
          title: "Happy New Year! 🎊",
          description:
            "A fresh start and new beginnings! New Year's Day marks the beginning of the calendar year and is celebrated worldwide with resolutions, hope, and excitement for the future.",
          details: [
            "🎊 Celebrating new beginnings and fresh starts",
            "🎯 Time for resolutions and goal setting",
            "🌟 Hope and excitement for the year ahead",
            "🗳️ New year, new opportunities for great leadership!",
          ],
          bgClass: "bg-gradient-to-br from-purple-600 via-blue-600 to-yellow-600",
          icon: <PartyPopper className="w-8 h-8" />,
          hasVideo: false,
        }
      case "valentine":
        return {
          title: "Happy Valentine's Day! 💝",
          description:
            "A celebration of love, friendship, and affection! Valentine's Day honors love in all its forms and encourages us to show appreciation for the special people in our lives.",
          details: [
            "💕 Celebrating love and friendship",
            "🌹 Flowers, cards, and sweet gestures",
            "💝 Showing appreciation for loved ones",
            "🗳️ Vote with love for leaders who care!",
          ],
          bgClass: "bg-gradient-to-br from-pink-600 via-red-600 to-pink-700",
          icon: <Heart className="w-8 h-8" />,
          hasVideo: false,
        }
      case "pride":
        return {
          title: "Happy Pride Month! 🏳️‍🌈",
          description:
            "Celebrating diversity, inclusion, and equality! Pride Month honors the LGBTQ+ community and commemorates the ongoing fight for equal rights and acceptance for all people.",
          details: [
            "🏳️‍🌈 Celebrating LGBTQ+ pride and diversity",
            "✊ Honoring the fight for equal rights",
            "🌈 Promoting love, acceptance, and inclusion",
            "🗳️ Vote for leaders who support equality for all!",
          ],
          bgClass:
            "bg-gradient-to-br from-red-500 via-yellow-500 via-green-500 via-blue-500 via-indigo-500 to-purple-500",
          icon: <Heart className="w-8 h-8" />,
          hasVideo: false,
        }
      default:
        return null
    }
  }

  const content = getHolidayContent()
  if (!content) return null

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`relative max-w-2xl w-full rounded-2xl shadow-2xl overflow-hidden ${content.bgClass}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="absolute top-4 right-4 z-10 text-white hover:bg-white/20 rounded-full"
            >
              <X className="w-5 h-5" />
            </Button>

            <div className="p-8 text-white">
              {/* Header */}
              <div className="text-center mb-6">
                <motion.div
                  animate={{
                    scale: [1, 1.1, 1],
                    rotate: [0, 5, -5, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }}
                  className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4"
                >
                  {content.icon}
                </motion.div>
                <h2 className="text-3xl md:text-4xl font-bold mb-2">{content.title}</h2>
                <p className="text-lg opacity-90">{content.description}</p>
              </div>

              {/* Video Section for Fourth of July */}
              {content.hasVideo && content.videoSrc && (
                <div className="mb-6">
                  <div className="relative rounded-lg overflow-hidden bg-black/20 backdrop-blur-sm">
                    <video autoPlay muted loop playsInline className="w-full h-48 object-cover">
                      <source src={content.videoSrc} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                  </div>
                </div>
              )}

              {/* Holiday Details */}
              <div className="space-y-3 mb-6">
                {content.details.map((detail, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * index }}
                    className="flex items-center space-x-3 text-sm md:text-base"
                  >
                    <span className="text-lg">{detail.split(" ")[0]}</span>
                    <span className="opacity-90">{detail.substring(detail.indexOf(" ") + 1)}</span>
                  </motion.div>
                ))}
              </div>

              {/* Action Button */}
              <div className="text-center">
                <Button
                  onClick={handleClose}
                  className="bg-white/20 hover:bg-white/30 text-white border border-white/30 px-8 py-2 rounded-full font-semibold transition-all duration-200"
                >
                  Continue to Vote {season.icon}
                </Button>
              </div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 bg-white/30 rounded-full"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                  }}
                  animate={{
                    scale: [0, 1, 0],
                    opacity: [0, 1, 0],
                  }}
                  transition={{
                    duration: 2 + Math.random() * 2,
                    repeat: Number.POSITIVE_INFINITY,
                    delay: Math.random() * 2,
                  }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
