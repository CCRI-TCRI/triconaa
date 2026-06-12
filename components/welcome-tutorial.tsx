"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronLeft,
  ChevronRight,
  Vote,
  Users,
  CheckCircle,
  Shield,
  Clock,
  Eye,
  UserCheck,
  Trophy,
} from "lucide-react"

interface WelcomeTutorialProps {
  onComplete: () => void
  studentName: string
}

const tutorialSteps = [
  {
    id: 1,
    title: "Welcome to E-Voting",
    description: "You're about to participate in your school's official elections.",
    icon: Vote,
    color: "from-[#168AAD] to-[#1E6091]",
    content: "This digital voting system ensures your vote is secure, private, and counted accurately.",
  },
  {
    id: 2,
    title: "Your Voting Process",
    description: "You'll vote for different positions across various categories.",
    icon: Users,
    color: "from-[#34A0A4] to-[#168AAD]",
    content: "Each position will be presented one at a time. Simply click on your preferred candidate to select them.",
  },
  {
    id: 3,
    title: "Security & Privacy",
    description: "Your vote is completely anonymous and secure.",
    icon: Shield,
    color: "from-[#52B69A] to-[#34A0A4]",
    content: "Once submitted, votes cannot be changed. Your identity is protected throughout the process.",
  },
  {
    id: 4,
    title: "Time Limit",
    description: "You have 5 minutes to complete your voting.",
    icon: Clock,
    color: "from-[#76C893] to-[#52B69A]",
    content: "A timer will show your remaining time. If time expires, you'll be automatically logged out.",
  },
  {
    id: 5,
    title: "Review & Submit",
    description: "Review all your selections before final submission.",
    icon: CheckCircle,
    color: "from-[#99D98C] to-[#52B69A]",
    content: "You'll see a summary of all your votes before confirming. Make sure everything is correct!",
  },
]

export function WelcomeTutorial({ onComplete, studentName }: WelcomeTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0)

  const nextStep = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      onComplete()
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const currentTutorial = tutorialSteps[currentStep]

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#168AAD] via-[#1A759F] to-[#184E77] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-2xl">
        <Card className="backdrop-blur-lg bg-white/95 border-white/20 shadow-2xl">
          <CardContent className="p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-4">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome, {studentName}!</h1>
                <p className="text-gray-600">Let's walk through the voting process</p>
              </motion.div>

              {/* Progress Indicator */}
              <div className="flex justify-center space-x-2 mb-6">
                {tutorialSteps.map((_, index) => (
                  <motion.div
                    key={index}
                    className={`w-3 h-3 rounded-full transition-all duration-300 ${
                      index === currentStep
                        ? "bg-[#168AAD] scale-125"
                        : index < currentStep
                          ? "bg-[#76C893]"
                          : "bg-gray-300"
                    }`}
                    initial={{ scale: 0 }}
                    animate={{ scale: index <= currentStep ? 1 : 0.8 }}
                    transition={{ delay: index * 0.1 }}
                  />
                ))}
              </div>

              <Badge variant="outline" className="px-4 py-2">
                Step {currentStep + 1} of {tutorialSteps.length}
              </Badge>
            </div>

            {/* Tutorial Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.3 }}
                className="text-center"
              >
                {/* Icon */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className={`mx-auto w-24 h-24 bg-gradient-to-r ${currentTutorial.color} rounded-full flex items-center justify-center mb-6 shadow-lg`}
                >
                  <currentTutorial.icon className="w-12 h-12 text-white" />
                </motion.div>

                {/* Content */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="space-y-4"
                >
                  <h2 className="text-2xl font-bold text-gray-900">{currentTutorial.title}</h2>
                  <p className="text-lg text-gray-700 font-medium">{currentTutorial.description}</p>
                  <p className="text-gray-600 max-w-lg mx-auto leading-relaxed">{currentTutorial.content}</p>
                </motion.div>

                {/* Mock Interface Preview */}
                {currentStep === 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="mt-8 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300"
                  >
                    <div className="text-sm text-gray-500 mb-3">Preview: Voting Interface</div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-white rounded border">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-[#168AAD] rounded-full flex items-center justify-center">
                            <UserCheck className="w-4 h-4 text-white" />
                          </div>
                          <span className="font-medium">Candidate Name</span>
                        </div>
                        <Trophy className="w-5 h-5 text-gray-400" />
                      </div>
                      <div className="text-xs text-gray-500">Click to select your preferred candidate</div>
                    </div>
                  </motion.div>
                )}

                {/* Security Preview */}
                {currentStep === 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="mt-8 grid grid-cols-3 gap-4"
                  >
                    <div className="text-center p-4 bg-emerald-50 rounded-lg">
                      <Shield className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                      <div className="text-sm font-medium text-emerald-700">Encrypted</div>
                    </div>
                    <div className="text-center p-4 bg-sky-50 rounded-lg">
                      <Eye className="w-8 h-8 text-sky-500 mx-auto mb-2" />
                      <div className="text-sm font-medium text-sky-700">Anonymous</div>
                    </div>
                    <div className="text-center p-4 bg-teal-50 rounded-lg">
                      <CheckCircle className="w-8 h-8 text-teal-500 mx-auto mb-2" />
                      <div className="text-sm font-medium text-teal-700">Verified</div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200"
            >
              <Button
                onClick={prevStep}
                disabled={currentStep === 0}
                variant="outline"
                className="flex items-center space-x-2 bg-transparent"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </Button>

              <div className="text-sm text-gray-500">
                {currentStep + 1} / {tutorialSteps.length}
              </div>

              <Button
                onClick={nextStep}
                className={`flex items-center space-x-2 ${
                  currentStep === tutorialSteps.length - 1
                    ? "bg-gradient-to-r from-[#52B69A] to-[#168AAD] hover:from-[#34A0A4] hover:to-[#1A759F]"
                    : "bg-gradient-to-r from-[#168AAD] to-[#1E6091] hover:from-[#1A759F] hover:to-[#184E77]"
                }`}
              >
                <span>{currentStep === tutorialSteps.length - 1 ? "Start Voting" : "Next"}</span>
                {currentStep === tutorialSteps.length - 1 ? (
                  <Vote className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </Button>
            </motion.div>

            {/* Skip Option */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-center mt-4"
            >
              <Button onClick={onComplete} variant="ghost" className="text-gray-500 hover:text-gray-700">
                Skip Tutorial
              </Button>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
