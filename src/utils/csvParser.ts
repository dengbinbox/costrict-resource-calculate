import type { ScenarioRecord, GpuModelRecord, ModelCapabilityRecord, RecommendModelGpuRecord } from '../types'

/** GPU 详细信息（通用，键=表头，值=单元格内容） */
export interface GpuInfoRecord {
  gpuName: string
  fields: Record<string, string>  // 表头 → 值（不含第一列 GPU 名称）
}

/** GPU Info 表格的元数据（表头顺序等） */
export interface GpuInfoMeta {
  headers: string[]               // 全部表头（含第一列"GPU名称"列）
  records: GpuInfoRecord[]
}

/** 模型详细信息（通用，键=表头，值=单元格内容） */
export interface ModelInfoRecord {
  modelName: string
  /** 第二列：多个 URL，以 | 分隔；解析后为 URL 数组 */
  urls: string[]
  fields: Record<string, string>  // 除第一、二列之外的其他列：表头 → 值
}

/** Model Info 表格的元数据（表头顺序等） */
export interface ModelInfoMeta {
  headers: string[]               // 全部表头（含第一列"模型名称"及第二列"模型地址"列）
  records: ModelInfoRecord[]
}

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
    priority: parseNum(cols[5] ?? ''),
  })).filter((r) => r.scene !== '')
}

/** 解析显卡模型 CSV */
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
    avgTTFT: parseNum(cols[11] ?? ''),
    tokenSpeedAvg: parseNum(cols[12] ?? ''),
    tag: cols[13]?.trim() ?? '',
    notes: cols[14]?.trim() ?? '',
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
 *      - 先四舍五入到最近整数
 *      - 若 minGpuCount 存在：向上取整到 minGpuCount 的整数倍（例: rounded=11, minGpuCount=2 → 12）
 *      - 否则：向上取整到 gpuPerMachine（单机显卡数）的整数倍
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
  avgTTFT: number | null
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

  // 取整：先四舍五入，再按最低卡数/单机卡数向上对齐
  const rounded = Math.max(1, Math.round(gpuCountExact))
  let gpuCount: number
  if (base.minGpuCount != null && base.minGpuCount > 0) {
    // 向上取整到 minGpuCount 的整数倍（rounded=11, minGpuCount=2 → 12）
    gpuCount = Math.ceil(rounded / base.minGpuCount) * base.minGpuCount
  } else {
    // 向上取整到 gpuPerMachine（单机卡数）的整数倍
    gpuCount = Math.ceil(rounded / base.gpuPerMachine) * base.gpuPerMachine
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
    avgTTFT: base.avgTTFT,
    tokenSpeedAvg: base.tokenSpeedAvg,
  }
}

/**
 * 解析 GPU Info CSV（通用，不假设列结构）
 * 第一行是表头，第一列是 GPU 名称
 */
export function parseGpuInfoCSV(text: string): GpuInfoMeta {
  const rows = parseCSV(text)
  if (rows.length === 0) return { headers: [], records: [] }

  const headers = rows[0].map((h) => h.trim())
  const gpuNameHeader = headers[0] ?? 'GPU'
  const dataHeaders = headers.slice(1)

  const records: GpuInfoRecord[] = rows.slice(1)
    .filter((cols) => (cols[0]?.trim() ?? '') !== '')
    .map((cols) => {
      const fields: Record<string, string> = {}
      dataHeaders.forEach((h, i) => {
        fields[h] = cols[i + 1]?.trim() ?? ''
      })
      return {
        gpuName: cols[0].trim(),
        fields,
      }
    })

  // 在返回的 headers 中用"GPU名称"替代原始第一列标题
  return {
    headers: [gpuNameHeader, ...dataHeaders],
    records,
  }
}

/**
 * 解析 Model Info CSV
 * 格式：第一列=模型名称，第二列=模型地址（多个URL以 | 分隔），其余列为任意扩展字段
 */
export function parseModelInfoCSV(text: string): ModelInfoMeta {
  const rows = parseCSV(text)
  if (rows.length === 0) return { headers: [], records: [] }

  const headers = rows[0].map((h) => h.trim())
  const dataHeaders = headers.slice(2)   // 第三列起为扩展字段

  const records: ModelInfoRecord[] = rows.slice(1)
    .filter((cols) => (cols[0]?.trim() ?? '') !== '')
    .map((cols) => {
      const rawUrls = cols[1]?.trim() ?? ''
      const urls = rawUrls
        .split('|')
        .map((u) => u.trim())
        .filter((u) => u !== '')

      const fields: Record<string, string> = {}
      dataHeaders.forEach((h, i) => {
        fields[h] = cols[i + 2]?.trim() ?? ''
      })

      return {
        modelName: cols[0].trim(),
        urls,
        fields,
      }
    })

  return {
    headers,
    records,
  }
}

/**
 * 解析模型能力榜单 CSV
 * 格式：
 *   天体榜单,GLM-Air,MiniMaxM2.7,GLM-4.7-FP8
 *   模型能力，满分100,0,33.33,29.41
 *   注释
 * 第一行：第2列起是模型名称
 * 第二行：第2列起是模型能力分数
 * 第三行（可选）：模型注释，hover 时展示
 */
export function parseModelCapabilityCSV(text: string): ModelCapabilityRecord[] {
  const rows = parseCSV(text)
  if (rows.length < 2) return []

  const headerRow = rows[0]  // 模型名称行
  const valueRow = rows[1]   // 能力分数行
  const commentRow = rows.length >= 3 ? rows[2] : null  // 第3行注释（可选）

  const records: ModelCapabilityRecord[] = []
  for (let i = 1; i < headerRow.length && i < valueRow.length; i++) {
    const modelName = headerRow[i]?.trim() ?? ''
    const capability = parseNum(valueRow[i] ?? '') ?? 0
    const comment = commentRow != null ? (commentRow[i]?.trim() ?? '') : ''
    if (modelName !== '') {
      records.push({ modelName, capability, comment })
    }
  }

  return records
}

/**
 * 解析推荐模型-显卡配对 CSV
 * 格式：
 *   model_name,gpu_name
 *   MiniMaxM2.7,B300
 *   GLM-4.7-FP8,
 * gpu_name 为空时表示仅推荐模型，不指定特定显卡
 */
export function parseRecommendModelGpuCSV(text: string): RecommendModelGpuRecord[] {
  const rows = parseCSV(text)
  if (rows.length < 2) return []
  return rows.slice(1)
    .map((cols) => ({
      modelName: cols[0]?.trim() ?? '',
      gpuName: cols[1]?.trim() ?? '',
    }))
    .filter((r) => r.modelName !== '')
}
