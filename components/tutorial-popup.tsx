"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { motion, AnimatePresence } from "framer-motion"
import { User, Camera, Vote, CheckCircle, ArrowRight, ArrowLeft, X, Shield, Clock, Users } from "lucide-react"

interface TutorialStep {
  id: number
  title: string
  description: string
  icon: React.ReactNode
  tips: string[]
}

const tutorialSteps: TutorialStep[] = [
  {
    id: 1,
    title: "Welcome to Lubiri Royal Ballot E-Voting Platform",
    description: "This secure digital voting system ensures your voice is heard in school elections.",
    icon: <Vote className="w-8 h-8 text-blue-500" />,
    tips: [
      "Your vote is completely anonymous and secure",
      "Each student gets one vote per position",
      "Results are tallied in real-time",
    ],
  },
  {
    id: 2,
    title: "Student Authentication",
    description: "Enter your student ID and voting code to access your ballot.",
    icon: <User className="w-8 h-8 text-green-500" />,
    tips: [
      "Your voting code was provided by the school administration",
      "Keep your credentials secure and don't share them",
      "Contact admin if you've lost your voting code",
    ],
  },
  {
    id: 3,
    title: "Biometric Verification",
    description: "Use face recognition for additional security (optional but recommended).",
    icon: <Camera className="w-8 h-8 text-purple-500" />,
    tips: [
      "Look directly at the camera for best results",
      "Ensure good lighting for face detection",
      "This prevents unauthorized voting",
      "This system is still under development",
    ],
  },
  {
    id: 4,
    title: "Cast Your Vote",
    description: "Select your preferred candidates for each position and submit your ballot.",
    icon: <CheckCircle className="w-8 h-8 text-orange-500" />,
    tips: [
      "Review all selections before submitting",
      "You have 5 minutes to complete voting",
      "Once submitted, votes cannot be changed",
    ],
  },
]

export function TutorialPopup() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem("lubiri-voting-tutorial-seen")
    if (!hasSeenTutorial) {
      const timer = setTimeout(() => {
        setIsOpen(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleClose = () => {
    setIsOpen(false)
    localStorage.setItem("lubiri-voting-tutorial-seen", "true")
  }

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleClose()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const currentStepData = tutorialSteps[currentStep]

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              Voting Tutorial
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            {tutorialSteps.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all ${
                  index === currentStep
                    ? "w-8 bg-blue-500"
                    : index < currentStep
                      ? "w-2 bg-green-500"
                      : "w-2 bg-gray-200"
                }`}
              />
            ))}
            <Badge variant="outline" className="ml-auto">
              {currentStep + 1} of {tutorialSteps.length}
            </Badge>
          </div>
        </DialogHeader>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="py-6"
          >
            <div className="text-center mb-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full mb-4"
              >
                {currentStepData.icon}
              </motion.div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{currentStepData.title}</h3>
              <p className="text-gray-600 text-lg">{currentStepData.description}</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Key Points:
              </h4>
              <ul className="space-y-2">
                {currentStepData.tips.map((tip, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="flex items-start gap-2 text-sm text-gray-700"
                  >
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    {tip}
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="flex items-center gap-2 bg-transparent"
          >
            <ArrowLeft className="w-4 h-4" />
            Previous
          </Button>

          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            <span>Takes 1 minute</span>
          </div>

          <Button
            onClick={handleNext}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
          >
            {currentStep === tutorialSteps.length - 1 ? "Get Started" : "Next"}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
