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
    description: "You're about to participate in the 2025 S3 H Test Elections at Lubiri Secondary School by Unjovu.",
    icon: Vote,
    color: "from-blue-500 to-purple-500",
    content: "This digital voting system ensures your vote is secure, private, and counted accurately.",
  },
  {
    id: 2,
    title: "Your Voting Process",
    description: "You'll vote for different positions across various categories.",
    icon: Users,
    color: "from-green-500 to-blue-500",
    content: "Each position will be presented one at a time. Simply click on your preferred candidate to select them.",
  },
  {
    id: 3,
    title: "Security & Privacy",
    description: "Your vote is completely anonymous and secure.",
    icon: Shield,
    color: "from-purple-500 to-pink-500",
    content: "Once submitted, votes cannot be changed. Your identity is protected throughout the process.",
  },
  {
    id: 4,
    title: "Time Limit",
    description: "You have 5 minutes to complete your voting.",
    icon: Clock,
    color: "from-orange-500 to-red-500",
    content: "A timer will show your remaining time. If time expires, you'll be automatically logged out.",
  },
  {
    id: 5,
    title: "Review & Submit",
    description: "Review all your selections before final submission.",
    icon: CheckCircle,
    color: "from-green-500 to-teal-500",
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
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-pink-500 to-purple-600 flex items-center justify-center p-4">
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
                        ? "bg-blue-500 scale-125"
                        : index < currentStep
                          ? "bg-green-500"
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
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
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
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <Shield className="w-8 h-8 text-green-500 mx-auto mb-2" />
                      <div className="text-sm font-medium text-green-700">Encrypted</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <Eye className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                      <div className="text-sm font-medium text-blue-700">Anonymous</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <CheckCircle className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                      <div className="text-sm font-medium text-purple-700">Verified</div>
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
                    ? "bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
                    : "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
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
