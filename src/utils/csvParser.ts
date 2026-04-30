import type { ScenarioRecord, GpuModelRecord } from '../types'

/** 解析数值，空字符串或非法值返回 null */
function parseNum(val: string): number | null {
  const trimmed = val.trim()
  if (trimmed === '' || trimmed === '-') return null
  const n = parseFloat(trimmed)
  return isNaN(n) ? null : n
}

/** 解析必须存在的数值，非法则返回 0 */
function parseNumRequired(val: string): number {
  return parseNum(val) ?? 0
}

/** 通用 CSV 解析（支持带换行的 CSV） */
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  const lines = text.trim().split('\n')
  for (const line of lines) {
    if (line.trim() === '') continue
    // 简单按逗号分割（字段内不含逗号场景）
    rows.push(line.split(','))
  }
  return rows
}

/** 解析场景 CSV */
export function parseScenariosCSV(text: string): ScenarioRecord[] {
  const rows = parseCSV(text)
  // 跳过表头
  return rows.slice(1).map((cols) => ({
    scene: cols[0]?.trim() ?? '',
    totalEmployees: parseNumRequired(cols[1] ?? ''),
    activeUsers: parseNumRequired(cols[2] ?? ''),
    rpm: parseNumRequired(cols[3] ?? ''),
    concurrency: parseNum(cols[4] ?? ''),
  })).filter((r) => r.scene !== '')
}

/** 解析显卡模型 CSV */
export function parseGpuModelsCSV(text: string): GpuModelRecord[] {
  const rows = parseCSV(text)
  // 跳过表头
  return rows.slice(1).map((cols) => ({
    gpuName: cols[0]?.trim() ?? '',
    gpuPrice: parseNumRequired(cols[1] ?? ''),
    modelName: cols[2]?.trim() ?? '',
    gpuPerMachine: parseNumRequired(cols[3] ?? ''),
    machineCount: parseNumRequired(cols[4] ?? ''),
    minGpuCount: parseNum(cols[5] ?? ''),
    supportedRpm: parseNumRequired(cols[6] ?? ''),
    supportedConcurrency: parseNum(cols[7] ?? ''),
    ttftP99: parseNum(cols[8] ?? ''),
    ttftP95: parseNum(cols[9] ?? ''),
    ttftP90: parseNum(cols[10] ?? ''),
    tokenSpeedAvg: parseNum(cols[11] ?? ''),
  })).filter((r) => r.gpuName !== '' && r.modelName !== '')
}

/**
 * 根据所需 RPM 计算需要多少张显卡
 *
 * CSV 中 machineCount 台机器合计能支撑 supportedRpm RPM。
 * 逻辑：
 *   1. 每台机器 RPM = supportedRpm / machineCount
 *   2. 精确所需卡数（浮点）= (targetRpm / 每台RPM) × gpuPerMachine
 *   3. 取整规则：
 *      - 若 minGpuCount 存在：向上取整到 minGpuCount 的整数倍
 *      - 否则：四舍五入取整
 *   4. 所需机器数 = ceil(取整后卡数 / gpuPerMachine)
 */
export function estimateGpuCount(
  records: GpuModelRecord[],
  gpuName: string,
  modelName: string,
  targetRpm: number,
): {
  gpuCount: number          // 取整后的显卡总数
  gpuCountExact: number     // 精确浮点显卡数（用于 hover 展示）
  machineCount: number
  ttftP99: number | null
  ttftP95: number | null
  ttftP90: number | null
  tokenSpeedAvg: number | null
} | null {
  const matched = records.filter(
    (r) => r.gpuName === gpuName && r.modelName === modelName,
  )
  if (matched.length === 0) return null

  const base = matched[0]
  if (base.supportedRpm <= 0 || base.machineCount <= 0) return null

  // 每台机器能支撑的 RPM
  const rpmPerMachine = base.supportedRpm / base.machineCount
  // 精确所需卡数（浮点）
  const gpuCountExact = (targetRpm / rpmPerMachine) * base.gpuPerMachine

  // 取整：按 minGpuCount 的整数倍向上取整，否则四舍五入
  let gpuCount: number
  if (base.minGpuCount != null && base.minGpuCount > 0) {
    gpuCount = Math.ceil(gpuCountExact / base.minGpuCount) * base.minGpuCount
  } else {
    gpuCount = Math.round(gpuCountExact)
  }

  // 根据取整后的卡数反推机器数（向上取整）
  const machineCount = Math.ceil(gpuCount / base.gpuPerMachine)

  return {
    gpuCount,
    gpuCountExact,
    machineCount,
    ttftP99: base.ttftP99,
    ttftP95: base.ttftP95,
    ttftP90: base.ttftP90,
    tokenSpeedAvg: base.tokenSpeedAvg,
  }
}
