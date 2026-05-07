/** 场景数据（来自 scenarios.csv） */
export interface ScenarioRecord {
  scene: string        // 场景
  totalEmployees: number   // 全公司人数
  activeUsers: number      // 使用人数
  rpm: number             // RPM
  concurrency: number | null  // 并发
  priority: number | null  // 优先级（0=默认选中，其余从高到低排序）
}

/** 显卡模型数据（来自 gpu_models.csv） */
export interface GpuModelRecord {
  gpuName: string           // 机器显卡名称
  gpuPrice: number          // 显卡价格/张
  modelName: string         // 模型名称
  gpuPerMachine: number     // 单台机器显卡卡数
  machineCount: number      // 机器数目
  minGpuCount: number | null  // 最低卡数
  supportedRpm: number      // 支持的 RPM
  supportedConcurrency: number | null  // 支持的并发
  ttftP99: number | null    // TTFT-P99 (ms)
  ttftP95: number | null    // TTFT-P95(ms)
  ttftP90: number | null    // TTFT-P90(ms)
  tokenSpeedAvg: number | null  // token speed avg (t/s)
}
/** 估算结果（显卡数量 + 性能指标） */
export interface GpuEstimation {
  gpuCount: number
  ttftP99: number | null
  ttftP95: number | null
  ttftP90: number | null
  tokenSpeedAvg: number | null
  totalGpuCount: number  // 总卡数（单台*台数）
}

/** 模型能力榜单数据（来自 model-capability_leaderboard.csv） */
export interface ModelCapabilityRecord {
  modelName: string
  capability: number     // 模型能力分数 (0-100)
  comment: string        // 第3行注释，hover 时展示
}

/** 推荐模型-显卡配对（来自 recommend_model_gpu.csv） */
export interface RecommendModelGpuRecord {
  modelName: string
  gpuName: string  // 空字符串表示仅推荐模型，未指定显卡
}
