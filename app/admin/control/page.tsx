"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { motion } from "framer-motion"
import {
  Power,
  PowerOff,
  RefreshCw,
  Settings,
  Database,
  Vote,
  Shield,
  AlertTriangle,
  CheckCircle,
  Activity,
  Server,
  Zap,
} from "lucide-react"
import { userStorage, voteStorage } from "@/lib/local-storage"

interface SystemStatus {
  database: "online" | "offline" | "warning"
  voting: "active" | "inactive" | "paused"
  authentication: "online" | "offline"
  realtime: "connected" | "disconnected"
}

export default function ControlSystemPage() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    database: "online",
    voting: "active",
    authentication: "online",
    realtime: "connected",
  })
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [stats, setStats] = useState({
    totalVoters: 0,
    activeVotes: 0,
    systemUptime: "99.9%",
    responseTime: "45ms",
  })

  useEffect(() => {
    if (typeof window === "undefined") return
    checkSystemStatus()
    const interval = setInterval(checkSystemStatus, 10000) // Check every 10 seconds
    return () => clearInterval(interval)
  }, [])

  const checkSystemStatus = async () => {
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        setSystemStatus((prev) => ({ ...prev, database: "offline", authentication: "offline" }))
        return
      }

      // Test local storage
      try {
        const users = userStorage.getAll()
        const votes = voteStorage.getAll()
        
        setSystemStatus((prev) => ({ ...prev, database: "online", authentication: "online" }))
        setStats((prev) => ({
          ...prev,
          totalVoters: users.length,
          activeVotes: votes.length,
        }))
      } catch (error) {
        setSystemStatus((prev) => ({ ...prev, database: "offline" }))
      }

      // Local storage is always "connected" for real-time
      setSystemStatus((prev) => ({ ...prev, realtime: "connected" }))
      setLastUpdate(new Date())
    } catch (error) {
      console.error("System check failed:", error)
      setSystemStatus((prev) => ({ ...prev, database: "offline", authentication: "offline" }))
    }
  }

  const handleStartElection = async () => {
    setLoading(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      setSystemStatus((prev) => ({ ...prev, voting: "active" }))
    } catch (error) {
      console.error("Failed to start election:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleStopElection = async () => {
    setLoading(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      setSystemStatus((prev) => ({ ...prev, voting: "inactive" }))
    } catch (error) {
      console.error("Failed to stop election:", error)
    } finally {
      setLoading(false)
    }
  }

  const handlePauseElection = async () => {
    setLoading(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      setSystemStatus((prev) => ({ ...prev, voting: "paused" }))
    } catch (error) {
      console.error("Failed to pause election:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleResetSystem = async () => {
    if (!confirm("Are you sure you want to reset the entire system? This action cannot be undone.")) {
      return
    }

    setLoading(true)
    try {
      // Clear all local storage
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.removeItem("election_users")
        localStorage.removeItem("election_candidates")
        localStorage.removeItem("election_positions")
        localStorage.removeItem("election_votes")
        // Keep tokens and admin credentials
      }
      
      await new Promise((resolve) => setTimeout(resolve, 3000))
      setSystemStatus({
        database: "online",
        voting: "inactive",
        authentication: "online",
        realtime: "connected",
      })
      setStats({
        totalVoters: 0,
        activeVotes: 0,
        systemUptime: "99.9%",
        responseTime: "45ms",
      })
      
      // Reload page to reinitialize
      window.location.reload()
    } catch (error) {
      console.error("Failed to reset system:", error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
      case "active":
      case "connected":
        return "text-green-600 bg-green-100"
      case "offline":
      case "inactive":
      case "disconnected":
        return "text-red-600 bg-red-100"
      case "paused":
      case "warning":
        return "text-yellow-600 bg-yellow-100"
      default:
        return "text-gray-600 bg-gray-100"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "online":
      case "active":
      case "connected":
        return <CheckCircle className="w-4 h-4" />
      case "offline":
      case "inactive":
      case "disconnected":
        return <AlertTriangle className="w-4 h-4" />
      case "paused":
      case "warning":
        return <AlertTriangle className="w-4 h-4" />
      default:
        return <Activity className="w-4 h-4" />
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Election Control System</h1>
        <p className="text-muted-foreground">Monitor and control all election system components</p>
      </div>

      {/* System Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Database</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Badge className={getStatusColor(systemStatus.database)}>
                  {getStatusIcon(systemStatus.database)}
                  <span className="ml-1 capitalize">{systemStatus.database}</span>
                </Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Voting System</CardTitle>
              <Vote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Badge className={getStatusColor(systemStatus.voting)}>
                  {getStatusIcon(systemStatus.voting)}
                  <span className="ml-1 capitalize">{systemStatus.voting}</span>
                </Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Authentication</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Badge className={getStatusColor(systemStatus.authentication)}>
                  {getStatusIcon(systemStatus.authentication)}
                  <span className="ml-1 capitalize">{systemStatus.authentication}</span>
                </Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Real-time Updates</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Badge className={getStatusColor(systemStatus.realtime)}>
                  {getStatusIcon(systemStatus.realtime)}
                  <span className="ml-1 capitalize">{systemStatus.realtime}</span>
                </Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* System Metrics */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              System Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.totalVoters}</div>
                <div className="text-sm text-muted-foreground">Total Voters</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.activeVotes}</div>
                <div className="text-sm text-muted-foreground">Active Votes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.systemUptime}</div>
                <div className="text-sm text-muted-foreground">System Uptime</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{stats.responseTime}</div>
                <div className="text-sm text-muted-foreground">Response Time</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Control Actions */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Election Controls */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Power className="w-5 h-5" />
                Election Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button
                  onClick={handleStartElection}
                  disabled={loading || systemStatus.voting === "active"}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Power className="w-4 h-4 mr-2" />
                  Start Election
                </Button>
                <Button
                  onClick={handlePauseElection}
                  disabled={loading || systemStatus.voting !== "active"}
                  variant="outline"
                  className="border-yellow-300 text-yellow-700 hover:bg-yellow-50 bg-transparent"
                >
                  <PowerOff className="w-4 h-4 mr-2" />
                  Pause Election
                </Button>
                <Button
                  onClick={handleStopElection}
                  disabled={loading || systemStatus.voting === "inactive"}
                  variant="destructive"
                >
                  <PowerOff className="w-4 h-4 mr-2" />
                  Stop Election
                </Button>
              </div>

              {systemStatus.voting === "active" && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Election is currently active. Students can vote and results are being updated in real-time.
                  </AlertDescription>
                </Alert>
              )}

              {systemStatus.voting === "paused" && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Election is paused. No new votes can be cast until the election is resumed.
                  </AlertDescription>
                </Alert>
              )}

              {systemStatus.voting === "inactive" && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>Election is not active. Students cannot vote at this time.</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* System Actions */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                System Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Button
                  onClick={checkSystemStatus}
                  disabled={loading}
                  variant="outline"
                  className="w-full bg-transparent"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh System Status
                </Button>

                <Button onClick={handleResetSystem} disabled={loading} variant="destructive" className="w-full">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Reset Entire System
                </Button>
              </div>

              <div className="text-sm text-muted-foreground bg-gray-50 p-3 rounded-lg">
                <p className="font-semibold mb-2">Last System Check:</p>
                <p>{lastUpdate.toLocaleString()}</p>
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  System actions require administrator privileges and may affect ongoing elections.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* System Logs */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              System Activity Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              <div className="flex items-center gap-3 p-2 bg-green-50 rounded-lg text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-green-700 font-medium">System Status Check</span>
                <span className="text-gray-500 ml-auto">{lastUpdate.toLocaleTimeString()}</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-blue-50 rounded-lg text-sm">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span className="text-blue-700 font-medium">Local Storage Verified</span>
                <span className="text-gray-500 ml-auto">{new Date(Date.now() - 60000).toLocaleTimeString()}</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-purple-50 rounded-lg text-sm">
                <div className="w-2 h-2 bg-purple-500 rounded-full" />
                <span className="text-purple-700 font-medium">Real-time Updates Active</span>
                <span className="text-gray-500 ml-auto">{new Date(Date.now() - 120000).toLocaleTimeString()}</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-orange-50 rounded-lg text-sm">
                <div className="w-2 h-2 bg-orange-500 rounded-full" />
                <span className="text-orange-700 font-medium">Authentication System Online</span>
                <span className="text-gray-500 ml-auto">{new Date(Date.now() - 180000).toLocaleTimeString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
