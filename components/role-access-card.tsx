"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { motion } from "framer-motion"
import { Shield, GraduationCap, Users, Eye, ArrowRight } from "lucide-react"
import Link from "next/link"

interface RoleAccessCardProps {
  role: "chairperson" | "headteacher"
  title: string
  description: string
  features: string[]
  loginPath: string
  delay?: number
}

export function RoleAccessCard({ role, title, description, features, loginPath, delay = 0 }: RoleAccessCardProps) {
  const getIcon = () => {
    switch (role) {
      case "chairperson":
        return <Shield className="w-8 h-8" />
      case "headteacher":
        return <GraduationCap className="w-8 h-8" />
      default:
        return <Users className="w-8 h-8" />
    }
  }

  const getGradient = () => {
    switch (role) {
      case "chairperson":
        return "from-blue-500 to-indigo-600"
      case "headteacher":
        return "from-green-500 to-emerald-600"
      default:
        return "from-gray-500 to-gray-600"
    }
  }

  const getBadgeColor = () => {
    switch (role) {
      case "chairperson":
        return "bg-blue-100 text-blue-800 border-blue-300"
      case "headteacher":
        return "bg-green-100 text-green-800 border-green-300"
      default:
        return "bg-gray-100 text-gray-800 border-gray-300"
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ scale: 1.02 }}
      className="h-full"
    >
      <Card className="h-full border-2 hover:shadow-lg transition-all duration-300">
        <CardHeader className="text-center space-y-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: delay + 0.2 }}
            className={`mx-auto w-16 h-16 bg-gradient-to-br ${getGradient()} rounded-full flex items-center justify-center text-white shadow-lg`}
          >
            {getIcon()}
          </motion.div>
          <div>
            <CardTitle className="text-xl font-bold text-gray-800">{title}</CardTitle>
            <p className="text-gray-600 mt-2">{description}</p>
            <Badge className={`mt-3 ${getBadgeColor()}`}>
              <Eye className="w-3 h-3 mr-1" />
              Read-Only Access
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-700 flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Dashboard Features
            </h4>
            <ul className="space-y-2">
              {features.map((feature, index) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: delay + 0.3 + index * 0.1 }}
                  className="flex items-center gap-2 text-sm text-gray-600"
                >
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                  {feature}
                </motion.li>
              ))}
            </ul>
          </div>

          <Link href={loginPath} className="block">
            <Button className={`w-full bg-gradient-to-r ${getGradient()} hover:opacity-90 transition-opacity`}>
              Access Dashboard
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </motion.div>
  )
}
