"use client"

import { motion } from "framer-motion"
import { RoleAccessCard } from "@/components/role-access-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Shield, GraduationCap, Users, Eye, Lock, CheckCircle } from "lucide-react"

export default function AdminAccessPage() {
  const chairpersonFeatures = [
    "Live election results monitoring",
    "Real-time voting statistics",
    "Candidate performance tracking",
    "Voter turnout analytics",
    "Election status overview",
    "Recent voting activity feed",
  ]

  const headteacherFeatures = [
    "Student leadership results",
    "School participation metrics",
    "Democratic process oversight",
    "Student engagement analytics",
    "Leadership position tracking",
    "School-wide voting statistics",
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900">Election System Access</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Secure access portals for election oversight and monitoring
          </p>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" className="px-3 py-1">
              <Lock className="w-3 h-3 mr-1" />
              Secure Authentication
            </Badge>
            <Badge variant="outline" className="px-3 py-1">
              <Eye className="w-3 h-3 mr-1" />
              Read-Only Access
            </Badge>
            <Badge variant="outline" className="px-3 py-1">
              <CheckCircle className="w-3 h-3 mr-1" />
              Real-Time Updates
            </Badge>
          </div>
        </motion.div>

        {/* Access Cards */}
        <div className="grid gap-8 lg:grid-cols-2">
          <RoleAccessCard
            role="chairperson"
            title="Electoral Commission"
            description="Chairperson access to election monitoring and oversight dashboard"
            features={chairpersonFeatures}
            loginPath="/admin/chairperson/login"
            delay={0.2}
          />

          <RoleAccessCard
            role="headteacher"
            title="School Administration"
            description="Headteacher access to student leadership election oversight"
            features={headteacherFeatures}
            loginPath="/admin/headteacher/login"
            delay={0.4}
          />
        </div>

        {/* System Information */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Access Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <h4 className="font-semibold text-blue-700 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Electoral Commission Access
                  </h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>
                      <strong>Role:</strong> Election oversight and monitoring
                    </p>
                    <p>
                      <strong>Access Level:</strong> Read-only results dashboard
                    </p>
                    <p>
                      <strong>Features:</strong> Real-time election data, voting analytics
                    </p>
                    <p>
                      <strong>Authentication:</strong> Secure login required
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-green-700 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4" />
                    School Administration Access
                  </h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>
                      <strong>Role:</strong> Student leadership oversight
                    </p>
                    <p>
                      <strong>Access Level:</strong> Read-only school dashboard
                    </p>
                    <p>
                      <strong>Features:</strong> Student participation, leadership results
                    </p>
                    <p>
                      <strong>Authentication:</strong> Secure login required
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-yellow-800">Security Notice</p>
                    <p className="text-yellow-700">
                      Both access portals provide read-only access to election data. No administrative actions can be
                      performed through these interfaces. All access is logged and monitored.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
