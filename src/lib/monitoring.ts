import { db } from "@/lib/database"
import os from "os"

export interface LogApiRequestParams {
  tenantId?: string | null
  endpoint: string
  method: string
  statusCode: number
  duration: number
  apiKeyId?: string | null
}

/**
 * Logs an API request dynamically into the database.
 * Executes asynchronously in a fire-and-forget manner to keep response times sub-10ms.
 */
export async function logApiRequest(params: LogApiRequestParams) {
  try {
    await db.apiRequest.create({
      data: {
        tenantId: params.tenantId || null,
        endpoint: params.endpoint,
        method: params.method,
        statusCode: params.statusCode,
        duration: Math.round(params.duration),
        apiKeyId: params.apiKeyId || null,
      },
    })
  } catch (error) {
    console.error("[Monitoring] Failed to log API request:", error)
  }
}

/**
 * Internal helper to calculate active CPU ticks.
 */
function cpuAverage() {
  let totalIdle = 0
  let totalTick = 0
  const cpus = os.cpus()
  
  if (!cpus || cpus.length === 0) {
    return { idle: 0, total: 0 }
  }

  for (let i = 0, len = cpus.length; i < len; i++) {
    const cpu = cpus[i]
    for (const type in cpu.times) {
      totalTick += (cpu.times as any)[type]
    }
    totalIdle += cpu.times.idle
  }
  
  return { 
    idle: totalIdle / cpus.length, 
    total: totalTick / cpus.length 
  }
}

/**
 * Measures system CPU usage percentage over a brief 100ms window.
 */
export function getCpuUsage(): Promise<number> {
  return new Promise((resolve) => {
    const startMeasure = cpuAverage()
    setTimeout(() => {
      const endMeasure = cpuAverage()
      const idleDifference = endMeasure.idle - startMeasure.idle
      const totalDifference = endMeasure.total - startMeasure.total
      
      if (totalDifference === 0) {
        resolve(0)
        return
      }
      
      const percentageCpu = 100 - Math.round((100 * idleDifference) / totalDifference)
      resolve(Math.max(0, Math.min(100, percentageCpu)))
    }, 100)
  })
}

/**
 * Returns physical OS-level RAM percentage and detailed byte counts.
 */
export function getMemoryUsage() {
  const total = os.totalmem()
  const free = os.freemem()
  const used = total - free
  const percentage = Math.round((used / total) * 100)
  
  return {
    percentage: Math.max(0, Math.min(100, percentage)),
    metadata: {
      totalBytes: total,
      freeBytes: free,
      usedBytes: used,
    }
  }
}

/**
 * Compiles live hardware metrics and database traffic rates,
 * persists the results as historical system metrics, and cleans up entries older than 24 hours.
 */
export async function collectSystemMetrics() {
  try {
    const cpuVal = await getCpuUsage()
    const memInfo = getMemoryUsage()

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    // Count API requests in the last hour
    const requestsVal = await db.apiRequest.count({
      where: { createdAt: { gte: oneHourAgo } },
    })

    // Count API errors in the last hour (5xx status codes)
    const errorsVal = await db.apiRequest.count({
      where: {
        createdAt: { gte: oneHourAgo },
        statusCode: { gte: 500 },
      },
    })

    const timestamp = new Date()
    
    // Save to the database
    await Promise.all([
      db.systemMetric.create({
        data: { type: "cpu", value: cpuVal, timestamp }
      }),
      db.systemMetric.create({
        data: {
          type: "memory",
          value: memInfo.percentage,
          metadata: JSON.stringify(memInfo.metadata),
          timestamp,
        }
      }),
      db.systemMetric.create({
        data: { type: "requests", value: requestsVal, timestamp }
      }),
      db.systemMetric.create({
        data: { type: "errors", value: errorsVal, timestamp }
      })
    ])

    // Keep database size minimal: delete entries older than 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    await db.systemMetric.deleteMany({
      where: { timestamp: { lt: oneDayAgo } }
    }).catch(err => console.error("[Monitoring] Failed to prune system metrics:", err))

    return {
      cpu: cpuVal,
      memory: memInfo.percentage,
      memoryMetadata: memInfo.metadata,
      requests: requestsVal,
      errors: errorsVal,
      timestamp,
    }
  } catch (error) {
    console.error("[Monitoring] Failed to collect metrics:", error)
    return null
  }
}
