"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"

interface SeasonalBackgroundProps {
  theme: string
}

export function SeasonalBackground({ theme }: SeasonalBackgroundProps) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([])

  useEffect(() => {
    if (theme === "fourth-of-july") {
      // Create firework particles
      const newParticles = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 3,
      }))
      setParticles(newParticles)
    } else if (theme === "christmas") {
      // Create snow particles
      const newParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: -10,
        delay: Math.random() * 5,
      }))
      setParticles(newParticles)
    }
  }, [theme])

  const getBackgroundClass = () => {
    // Professional white and light gray theme for all occasions
    return "bg-gradient-to-br from-white via-blue-50 to-gray-100"
  }

  return (
    <div className={`fixed inset-0 -z-10 ${getBackgroundClass()}`}>
      {/* Fourth of July Fireworks */}
      {theme === "fourth-of-july" && (
        <>
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute w-2 h-2 bg-white rounded-full"
              style={{ left: `${particle.x}%`, top: `${particle.y}%` }}
              animate={{
                scale: [0, 1, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 2,
                repeat: Number.POSITIVE_INFINITY,
                delay: particle.delay,
              }}
            />
          ))}
          <motion.div
            className="absolute inset-0 bg-gradient-to-t from-transparent via-red-500/10 to-transparent"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY }}
          />
        </>
      )}

      {/* Christmas Snow */}
      {theme === "christmas" && (
        <>
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute w-1 h-1 bg-white rounded-full opacity-70"
              style={{ left: `${particle.x}%` }}
              animate={{
                y: ["0vh", "100vh"],
                x: [0, Math.sin(particle.id) * 50],
              }}
              transition={{
                duration: 8 + Math.random() * 4,
                repeat: Number.POSITIVE_INFINITY,
                delay: particle.delay,
                ease: "linear",
              }}
            />
          ))}
        </>
      )}

      {/* Halloween Lightning */}
      {theme === "halloween" && (
        <motion.div
          className="absolute inset-0 bg-purple-500/20"
          animate={{ opacity: [0, 0.8, 0] }}
          transition={{
            duration: 0.2,
            repeat: Number.POSITIVE_INFINITY,
            repeatDelay: 5 + Math.random() * 10,
          }}
        />
      )}
    </div>
  )
}
