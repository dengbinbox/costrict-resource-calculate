import { useEffect, useState, useMemo } from 'react'
import scenariosCsvRaw from '../../public/data/scenarios.csv?raw'
import gpuModelsCsvRaw from '../../public/data/gpu_models.csv?raw'
import {
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Form,
  InputNumber,
  Modal,
  Row,
  Select,
  Spin,
  Statistic,
  Tag,
  Tooltip,
  Typography,
  Alert,
  Space,
  Badge,
  Empty,
} from 'antd'
import {
  CalculatorOutlined,
  DatabaseOutlined,
  ThunderboltOutlined,
  DollarOutlined,
  InfoCircleOutlined,
  TeamOutlined,
  RocketOutlined,
  EyeOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import { parseScenariosCSV, parseGpuModelsCSV, estimateGpuCount, parseGpuInfoCSV, parseModelInfoCSV } from '../utils/csvParser'
import type { GpuInfoMeta, ModelInfoMeta } from '../utils/csvParser'
import type { ScenarioRecord, GpuModelRecord } from '../types'

const { Title, Text } = Typography
const { Option } = Select

/** 格式化数字，保留最多 2 位小数 */
function fmt(n: number | null | undefined, suffix = ''): string {
  if (n == null) return 'N/A'
  return `${Number(n.toFixed(2))}${suffix}`
}

/** 格式化金额 */
function fmtMoney(n: number): string {
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)} 亿元`
  if (n >= 1e4) return `${(n / 1e4).toFixed(2)} 万元`
  return `${n.toLocaleString()} 元`
}

// ─── 性能指标悬浮卡片 ────────────────────────────────────────────────────────
interface PerfTooltipProps {
  ttftP99: number | null
  ttftP95: number | null
  ttftP90: number | null
  tokenSpeedAvg: number | null
}

function PerfTooltipContent({ ttftP99, ttftP95, ttftP90, tokenSpeedAvg }: PerfTooltipProps) {
  const items = [
    { label: 'TTFT-P99', value: fmt(ttftP99, ' ms'), color: '#ff4d4f' },
    { label: 'TTFT-P95', value: fmt(ttftP95, ' ms'), color: '#fa8c16' },
    { label: 'TTFT-P90', value: fmt(ttftP90, ' ms'), color: '#fadb14' },
    { label: 'Token Speed Avg', value: fmt(tokenSpeedAvg, ' t/s'), color: '#52c41a' },
  ]
  return (
    <div style={{ minWidth: 200 }}>
      <Text strong style={{ color: '#fff', fontSize: 13 }}>性能指标</Text>
      <div style={{ marginTop: 8 }}>
        {items.map((item) => (
          <div
            key={item.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '4px 0',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>{item.label}</Text>
            <Tag color={item.value === 'N/A' ? 'default' : 'blue'} style={{ margin: 0, fontSize: 12 }}>
              {item.value}
            </Tag>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── GPU 估算结果卡片 ──────────────────────────────────────────────────────────
interface GpuResultCardProps {
  title: string
  subtitle: string
  gpuCount: number | null
  gpuCountExact: number | null
  machineCount: number | null
  gpuPerMachine: number | null
  gpuPrice: number | null
  perfData: PerfTooltipProps | null
  icon: React.ReactNode
  color: string
  isCustom?: boolean
}

function GpuResultCard({
  title,
  subtitle,
  gpuCount,
  gpuCountExact,
  machineCount,
  gpuPerMachine,
  gpuPrice,
  perfData,
  icon,
  color,
  isCustom = false,
}: GpuResultCardProps) {
  const displayMachineCount = machineCount === 0 ? 1 : machineCount
  const displayGpuCount = machineCount === 0 ? (gpuPerMachine ?? 0) : gpuCount
  const cost = (() => {
    if (displayGpuCount == null || gpuPrice == null) return null
    return displayGpuCount * gpuPrice
  })()

  return (
    <Card
      bordered={false}
      style={{
        borderRadius: 16,
        background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
        border: `1px solid ${color}30`,
        height: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: `${color}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            color,
          }}
        >
          {icon}
        </div>
        <div>
          <Text strong style={{ fontSize: 15, display: 'block' }}>{title}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{subtitle}</Text>
        </div>
        {isCustom && <Badge count="自定义" style={{ backgroundColor: '#722ed1' }} />}
      </div>

      <Row gutter={[16, 16]}>
        {/* 机器数 */}
        <Col span={8}>
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              padding: '12px 10px',
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>所需机器数</div>
            {machineCount != null ? (
              <Tooltip
                title={
                  gpuPerMachine != null
                    ? `单台机器配备 ${gpuPerMachine} 张显卡`
                    : '单台显卡数据未知'
                }
                placement="top"
              >
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color,
                    cursor: 'help',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                  }}
                >
                  {displayMachineCount}
                  <InfoCircleOutlined style={{ fontSize: 13, color: '#8c8c8c' }} />
                </div>
              </Tooltip>
            ) : (
              <div style={{ fontSize: 24, fontWeight: 700, color: '#bfbfbf' }}>N/A</div>
            )}
            <div style={{ fontSize: 11, color: '#bfbfbf' }}>台</div>
          </div>
        </Col>

        {/* 显卡数 */}
        <Col span={8}>
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              padding: '12px 10px',
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>所需显卡数</div>
            {gpuCount != null && perfData ? (
              <Tooltip
                title={
                  <div style={{ minWidth: 220 }}>
                    {gpuCountExact != null && (
                      <div style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
                        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>精确计算值</Text>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>
                          {gpuCountExact.toFixed(4)} 张
                        </div>
                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
                          →取整后：{displayGpuCount} 张
                        </Text>
                      </div>
                    )}
                    <PerfTooltipContent {...perfData} />
                  </div>
                }
                color="#001529"
                placement="top"
                overlayStyle={{ maxWidth: 280 }}
              >
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color,
                    cursor: 'help',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                  }}
                >
                  {displayGpuCount}
                  <InfoCircleOutlined style={{ fontSize: 13, color: '#8c8c8c' }} />
                </div>
              </Tooltip>
            ) : (
              <div style={{ fontSize: 24, fontWeight: 700, color: '#bfbfbf' }}>N/A</div>
            )}
            <div style={{ fontSize: 11, color: '#bfbfbf' }}>张</div>
          </div>
        </Col>

        {/* 花费 */}
        <Col span={8}>
          <div
            style={{
              background: '#fff',
              borderRadius: 10,
              padding: '12px 10px',
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>预估花费</div>
            {cost != null ? (
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color }}>
                  {(cost / 1e4).toFixed(0)}
                </div>
                <div style={{ fontSize: 11, color: '#8c8c8c' }}>万元</div>
              </div>
            ) : (
              <div style={{ fontSize: 24, fontWeight: 700, color: '#bfbfbf' }}>N/A</div>
            )}
          </div>
        </Col>
      </Row>

      {cost != null && (
        <div
          style={{
            marginTop: 12,
            padding: '8px 12px',
            background: `${color}10`,
            borderRadius: 8,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>总计</Text>
          <Text strong style={{ color, fontSize: 13 }}>{fmtMoney(cost)}</Text>
        </div>
      )}
    </Card>
  )
}

// ─── 主页面 ────────────────────────────────────────────────────────────────────
export default function ResourceEstimator() {
  const [scenarios, setScenarios] = useState<ScenarioRecord[]>([])
  const [gpuModels, setGpuModels] = useState<GpuModelRecord[]>([])
  const [gpuInfo, setGpuInfo] = useState<GpuInfoMeta>({ headers: [], records: [] })
  const [modelInfo, setModelInfo] = useState<ModelInfoMeta>({ headers: [], records: [] })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // GPU 详情弹窗状态
  const [gpuInfoModalOpen, setGpuInfoModalOpen] = useState(false)
  // 模型详情弹窗状态
  const [modelInfoModalOpen, setModelInfoModalOpen] = useState(false)

  // 用户输入状态
  const [companySize, setCompanySize] = useState<number | null>(null)
  const [selectedScene, setSelectedScene] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [selectedGpu, setSelectedGpu] = useState<string | null>(null)
  const [customUsers, setCustomUsers] = useState<number | null>(null)
  const [customRpm, setCustomRpm] = useState<number | null>(null)

  // ── 加载 CSV ─────────────────────────────────────────────────────────────
  useEffect(() => {
    // 场景和模型数据内联（?raw），直接解析
    try {
      const rawScenarios = parseScenariosCSV(scenariosCsvRaw)
      // 排序：优先级为0的排最前（作为默认），其余按优先级从高到低
      const sorted = [...rawScenarios].sort((a, b) => {
        const pa = a.priority
        const pb = b.priority
        if (pa === 0 && pb !== 0) return -1
        if (pb === 0 && pa !== 0) return 1
        if (pa === 0 && pb === 0) return 0
        // 其余：从高到低（null 放最后）
        if (pa == null && pb == null) return 0
        if (pa == null) return 1
        if (pb == null) return -1
        return pb - pa
      })
      setScenarios(sorted)
      // 默认选中优先级为 0 的场景
      const defaultScene = sorted.find((s) => s.priority === 0)
      if (defaultScene) setSelectedScene(defaultScene.scene)
      setGpuModels(parseGpuModelsCSV(gpuModelsCsvRaw))
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '数据加载异常')
      setLoading(false)
      return
    }
    // GPU Info / Model Info 表格动态 fetch（后台可随时更新）
    const baseUrl = import.meta.env.BASE_URL.replace(/\/?$/, '/')

    const fetchCsv = (filename: string) =>
      fetch(`${baseUrl}data/${filename}`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.text()
        })
        .then((text) => {
          const trimmed = text.trim()
          // 防止 nginx SPA fallback 返回 HTML 被当做 CSV 解析
          return trimmed.startsWith('<') ? '' : trimmed
        })
        .catch(() => '')

    Promise.all([fetchCsv('gpu_info.csv'), fetchCsv('model_info.csv')])
      .then(([gpuText, modelText]) => {
        if (gpuText) setGpuInfo(parseGpuInfoCSV(gpuText))
        if (modelText) setModelInfo(parseModelInfoCSV(modelText))
      })
      .finally(() => setLoading(false))
  }, [])

  // ── 派生数据 ──────────────────────────────────────────────────────────────

  /** 当前选择的场景记录 */
  const sceneRecord = useMemo(
    () => scenarios.find((s) => s.scene === selectedScene) ?? null,
    [scenarios, selectedScene],
  )

  /** 预估同时使用人数 */
  const estimatedUsers = useMemo(() => {
    if (!sceneRecord || !companySize) return null
    let effectiveCompanySize = companySize
    if (companySize < 15) effectiveCompanySize = 30
    else if (companySize < 50) effectiveCompanySize = 50
    else if (companySize < 100) effectiveCompanySize = 100
    let users = Math.round((sceneRecord.activeUsers / sceneRecord.totalEmployees) * effectiveCompanySize)
    if (companySize < 15 && users > companySize) {
      users = companySize
    }
    return Math.max(1, users)
  }, [sceneRecord, companySize])

  /** 预估使用 RPM */
  const estimatedRpm = useMemo(() => {
    if (!sceneRecord || estimatedUsers == null) return null
    const minRpm = sceneRecord.rpm / sceneRecord.activeUsers
    return Math.max(minRpm, (sceneRecord.rpm / sceneRecord.activeUsers) * estimatedUsers)
  }, [sceneRecord, estimatedUsers])

  /** 自定义使用 RPM（如果用户未输入，则通过公式计算） */
  const effectiveCustomRpm = useMemo(() => {
    if (customRpm != null) return customRpm
    if (customUsers == null || !sceneRecord) return null
    return (sceneRecord.rpm / sceneRecord.activeUsers) * customUsers
  }, [customRpm, customUsers, sceneRecord])

  /** 所有模型列表（去重） */
  const allModels = useMemo(
    () => [...new Set(gpuModels.map((r) => r.modelName))],
    [gpuModels],
  )

  /** 根据选中模型，过滤可用的显卡类型 */
  const availableGpus = useMemo(() => {
    if (!selectedModel) return []
    return [...new Set(gpuModels.filter((r) => r.modelName === selectedModel).map((r) => r.gpuName))]
  }, [gpuModels, selectedModel])

  /** 当模型变化时，重置显卡选择（如果当前 gpu 不在可用列表中） */
  useEffect(() => {
    if (selectedGpu && !availableGpus.includes(selectedGpu)) {
      setSelectedGpu(null)
    }
  }, [availableGpus, selectedGpu])

  /** 预估显卡数量（基于 estimatedRpm） */
  const estimatedGpuResult = useMemo(() => {
    if (!selectedModel || !selectedGpu || estimatedRpm == null) return null
    return estimateGpuCount(gpuModels, selectedGpu, selectedModel, estimatedRpm)
  }, [gpuModels, selectedModel, selectedGpu, estimatedRpm])

  /** 自定义显卡数量（基于 effectiveCustomRpm） */
  const customGpuResult = useMemo(() => {
    if (!selectedModel || !selectedGpu || effectiveCustomRpm == null) return null
    return estimateGpuCount(gpuModels, selectedGpu, selectedModel, effectiveCustomRpm)
  }, [gpuModels, selectedModel, selectedGpu, effectiveCustomRpm])

  /** 当前 GPU 单价 */
  const gpuUnitPrice = useMemo(() => {
    if (!selectedGpu || !selectedModel) return null
    const rec = gpuModels.find((r) => r.gpuName === selectedGpu && r.modelName === selectedModel)
    return rec?.gpuPrice ?? null
  }, [gpuModels, selectedGpu, selectedModel])

  // ── 渲染 ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" tip="正在加载数据..." />
      </div>
    )
  }

  if (loadError) {
    return (
      <Alert
        type="error"
        showIcon
        message="数据加载失败"
        description={loadError}
        style={{ margin: 24 }}
      />
    )
  }

  const isConfigComplete = selectedModel && selectedGpu

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 0 40px' }}>
      {/* 页面标题 */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
          borderRadius: '0 0 24px 24px',
          padding: '32px 32px 40px',
          marginBottom: 32,
          color: '#fff',
        }}
      >
        <Space align="center" size={12}>
          <CalculatorOutlined style={{ fontSize: 32 }} />
          <div>
            <Title level={3} style={{ color: '#fff', margin: 0 }}>
              GPU 资源预估计算器
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>
              基于使用场景与模型，智能预估所需显卡资源与预算
            </Text>
          </div>
        </Space>
      </div>

      <div style={{ padding: '0 24px' }}>
        {/* ── Section 1: 公司 & 场景配置 ─────────────────────────────────── */}
        <Card
          bordered={false}
          style={{ borderRadius: 16, marginBottom: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <TeamOutlined style={{ fontSize: 18, color: '#1677ff' }} />
            <Title level={5} style={{ margin: 0 }}>公司 & 场景配置</Title>
          </div>

          <Form layout="vertical" size="large">
            <Row gutter={[24, 0]}>
              <Col xs={24} sm={12} md={8}>
                <Form.Item
                  label={
                    <span>
                      公司开发人数
                      <Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>（人）</Text>
                    </span>
                  }
                >
                  <InputNumber
                    placeholder="请输入公司总人数"
                    min={1}
                    value={companySize}
                    onChange={(v) => setCompanySize(v)}
                    style={{ width: '100%' }}
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={(v) => Number(v!.replace(/,/g, ''))}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={12} md={8}>
                <Form.Item
                  label={
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      选择场景
                      <Tooltip title="不同场景会有不同的使用人数和接口调用量，选择合适的场景，我们将会自动计算大概的使用量">
                        <InfoCircleOutlined style={{ color: '#faad14', fontSize: 13, cursor: 'pointer' }} />
                      </Tooltip>
                    </span>
                  }
                >
                  <Select
                    placeholder="选择使用场景"
                    value={selectedScene}
                    onChange={setSelectedScene}
                    allowClear
                  >
                    {scenarios.map((s) => (
                      <Option key={s.scene} value={s.scene}>
                        <Tooltip
                          title={
                            <div style={{ fontSize: 12, lineHeight: '20px' }}>
                              <div style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>all / user / rpm</div>
                              <div style={{ color: '#fff', fontWeight: 600 }}>
                                {s.totalEmployees} / {s.activeUsers} / {s.rpm}
                              </div>
                            </div>
                          }
                          placement="right"
                          color="#001529"
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, width: '100%' }}>
                            {s.scene}
                            {s.priority === 0 && (
                              <Tag color="green" style={{ margin: 0, fontSize: 11 }}>默认</Tag>
                            )}
                          </span>
                        </Tooltip>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>

              {/* 预估结果展示 */}
              {sceneRecord && companySize && (
                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    label={
                      <span>
                        预估结果
                        <Tooltip
                          title={
                            <div style={{ maxWidth: 320 }}>
                              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>算法说明：</div>
                              <div>{'根据场景人数比例预估人数，人数低于一定数量则调整基数计算'}</div>
                              <div>1. 公司人数 ≥ 100：按实际人数计算</div>
                              <div>{'2. 公司人数 < 100：按 100 人计算'}</div>
                              <div>{'3. 公司人数 < 50：按 50 人计算'}</div>
                              <div>{'4. 公司人数 < 15：按 30 人计算；若结果 > 实际人数，则等于实际人数'}</div>
                              <div>5. 预估同时使用人数最小值为 1</div>
                            </div>
                          }
                        >
                          <ExclamationCircleOutlined style={{ marginLeft: 4, color: '#faad14', cursor: 'pointer' }} />
                        </Tooltip>
                      </span>
                    }
                  >
                    <div
                      style={{
                        display: 'flex',
                        gap: 12,
                        background: '#f0f5ff',
                        borderRadius: 10,
                        padding: '10px 14px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <Statistic
                        title={<span style={{ fontSize: 11 }}>预估同时使用人数(/h)</span>}
                        value={estimatedUsers ?? '-'}
                        suffix="人"
                        valueStyle={{ fontSize: 20, color: '#1677ff' }}
                      />
                      <Divider type="vertical" style={{ height: 40, margin: '4px 0' }} />
                      <Statistic
                        title={<span style={{ fontSize: 11 }}>预估使用 RPM</span>}
                        value={estimatedRpm != null ? estimatedRpm.toFixed(2) : '-'}
                        valueStyle={{ fontSize: 20, color: '#52c41a' }}
                      />
                    </div>
                  </Form.Item>
                </Col>
              )}
            </Row>
          </Form>
        </Card>

        {/* ── Section 2: 自定义输入 ─────────────────────────────────────── */}
        <Card
          bordered={false}
          style={{ borderRadius: 16, marginBottom: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <RocketOutlined style={{ fontSize: 18, color: '#722ed1' }} />
            <Title level={5} style={{ margin: 0 }}>自定义输入</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>（可选，用于自定义估算对比）</Text>
          </div>

          <Form layout="vertical" size="large">
            <Row gutter={[24, 0]}>
              <Col xs={24} sm={12} md={8}>
                <Form.Item
                  label={
                    <span>
                      自定义同时使用人数(/h)
                      <Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>（人）</Text>
                    </span>
                  }
                >
                  <div style={{ display: 'flex', gap: 8 }}>
                    <InputNumber
                      placeholder="自定义使用人数"
                      min={1}
                      value={customUsers}
                      onChange={(v) => setCustomUsers(v)}
                      style={{ flex: 1 }}
                    />
                    <Tooltip
                      title={
                        companySize
                          ? `占公司总人数 (${companySize} 人) 的百分比，修改后自动计算使用人数`
                          : '请先填写公司人数后再使用百分比'
                      }
                    >
                      <InputNumber
                        placeholder="百分比"
                        min={0}
                        max={100}
                        addonAfter="%"
                        value={
                          customUsers != null && companySize
                            ? Math.round((customUsers / companySize) * 10000) / 100
                            : undefined
                        }
                        onChange={(v) => {
                          if (v != null && companySize) {
                            setCustomUsers(Math.max(1, Math.round((v / 100) * companySize)))
                          }
                        }}
                        disabled={!companySize}
                        style={{ width: 80 }}
                      />
                    </Tooltip>
                  </div>
                </Form.Item>
              </Col>

              <Col xs={24} sm={12} md={8}>
                <Form.Item
                  label={
                    <Tooltip
                      title={
                        customUsers && sceneRecord
                          ? `每分钟请求数未填写时自动计算：(RPM/使用人数) × 自定义人数 = ${((sceneRecord.rpm / sceneRecord.activeUsers) * customUsers).toFixed(2)}`
                          : '每分钟请求数：未填写时通过场景比例公式自动计算（需先选择场景和自定义公司人数）'
                      }
                    >
                      <span>
                        自定义使用 RPM
                        <InfoCircleOutlined style={{ marginLeft: 4, color: '#8c8c8c' }} />
                      </span>
                    </Tooltip>
                  }
                >
                  <InputNumber
                    placeholder={
                      effectiveCustomRpm != null && customRpm == null
                        ? `自动: ${effectiveCustomRpm.toFixed(2)}`
                        : '自定义 RPM（留空自动计算）'
                    }
                    min={0}
                    value={customRpm}
                    onChange={(v) => setCustomRpm(v)}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>

              {/* 自定义 RPM 展示 */}
              <Col xs={24} sm={12} md={8}>
                <Form.Item label="自定义有效 RPM">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: '#f9f0ff',
                      borderRadius: 10,
                      padding: '12px 16px',
                      height: 56,
                    }}
                  >
                    {effectiveCustomRpm != null ? (
                      <div>
                        <Text strong style={{ fontSize: 22, color: '#722ed1' }}>
                          {effectiveCustomRpm.toFixed(2)}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>
                          {customRpm != null ? '（手动输入）' : '（自动计算）'}
                        </Text>
                      </div>
                    ) : (
                      <Text type="secondary">N/A</Text>
                    )}
                  </div>
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>

        {/* ── Section 3: 模型 & 显卡选择 ──────────────────────────────────── */}
        <Card
          bordered={false}
          style={{ borderRadius: 16, marginBottom: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <DatabaseOutlined style={{ fontSize: 18, color: '#13c2c2' }} />
            <Title level={5} style={{ margin: 0 }}>模型 & 显卡选择</Title>
          </div>

          <Form layout="vertical" size="large">
            <Row gutter={[24, 0]}>
              <Col xs={24} sm={12}>
                <Form.Item
                  label={
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      选择模型
                      {selectedModel && (
                        <Button
                          type="link"
                          size="small"
                          icon={<EyeOutlined />}
                          style={{ padding: '0 4px', height: 'auto', fontSize: 12 }}
                          onClick={() => setModelInfoModalOpen(true)}
                        >
                          查看模型详情
                        </Button>
                      )}
                    </span>
                  }
                >
                  <Select
                    placeholder="选择 AI 模型"
                    value={selectedModel}
                    onChange={(v) => {
                      setSelectedModel(v)
                      setSelectedGpu(null)
                    }}
                    allowClear
                    showSearch
                  >
                    {allModels.map((m) => (
                      <Option key={m} value={m}>{m}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>

              <Col xs={24} sm={12}>
                <Form.Item
                  label={
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      选择显卡类型
                      {!selectedModel && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          （请先选择模型）
                        </Text>
                      )}
                      {selectedGpu && (
                        <Button
                          type="link"
                          size="small"
                          icon={<EyeOutlined />}
                          style={{ padding: '0 4px', height: 'auto', fontSize: 12 }}
                          onClick={() => setGpuInfoModalOpen(true)}
                        >
                          查看显卡详情
                        </Button>
                      )}
                    </span>
                  }
                >
                  <Select
                    placeholder={selectedModel ? '选择显卡型号' : '请先选择模型'}
                    value={selectedGpu}
                    onChange={setSelectedGpu}
                    disabled={!selectedModel}
                    allowClear
                  >
                    {availableGpus.map((g) => (
                      <Option key={g} value={g}>
                        <Space>
                          <ThunderboltOutlined style={{ color: '#faad14' }} />
                          {g}
                          {gpuModels.find((r) => r.gpuName === g && r.modelName === selectedModel) && (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              ¥{(gpuModels.find((r) => r.gpuName === g && r.modelName === selectedModel)!.gpuPrice / 1e4).toFixed(0)}万/张
                            </Text>
                          )}
                        </Space>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>

        {/* ── Section 4: 估算结果 ──────────────────────────────────────────── */}
        {isConfigComplete ? (
          <>
            <Divider>
              <Space>
                <DollarOutlined style={{ color: '#1677ff' }} />
                <Text strong style={{ fontSize: 15 }}>估算结果</Text>
              </Space>
            </Divider>

            <Row gutter={[20, 20]}>
              <Col xs={24} md={12}>
                <GpuResultCard
                  title="预估显卡方案"
                  subtitle="基于场景数据推算"
                  gpuCount={estimatedGpuResult?.gpuCount ?? null}
                  gpuCountExact={estimatedGpuResult?.gpuCountExact ?? null}
                  machineCount={estimatedGpuResult?.machineCount ?? null}
                  gpuPerMachine={gpuModels.find((r) => r.gpuName === selectedGpu && r.modelName === selectedModel)?.gpuPerMachine ?? null}
                  gpuPrice={gpuUnitPrice}
                  perfData={estimatedGpuResult ?? null}
                  icon={<CalculatorOutlined />}
                  color="#1677ff"
                />
              </Col>
              <Col xs={24} md={12}>
                <GpuResultCard
                  title="自定义数据方案"
                  subtitle="基于自定义 RPM 推算"
                  gpuCount={customGpuResult?.gpuCount ?? null}
                  gpuCountExact={customGpuResult?.gpuCountExact ?? null}
                  machineCount={customGpuResult?.machineCount ?? null}
                  gpuPerMachine={gpuModels.find((r) => r.gpuName === selectedGpu && r.modelName === selectedModel)?.gpuPerMachine ?? null}
                  gpuPrice={gpuUnitPrice}
                  perfData={customGpuResult ?? null}
                  icon={<RocketOutlined />}
                  color="#722ed1"
                  isCustom
                />
              </Col>
            </Row>

            {/* 配置汇总 */}
            <Card
              bordered={false}
              style={{
                marginTop: 20,
                borderRadius: 16,
                background: '#fafafa',
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              }}
            >
              <Title level={5} style={{ marginTop: 0, marginBottom: 16, color: '#595959' }}>
                配置汇总
              </Title>
              <Row gutter={[16, 12]}>
                {[
                  { label: '公司人数', value: companySize ? `${companySize.toLocaleString()} 人` : '-' },
                  { label: '选择场景', value: selectedScene ?? '-' },
                  { label: '预估使用人数', value: estimatedUsers != null ? `${estimatedUsers} 人/h` : '-' },
                  { label: '预估 RPM', value: estimatedRpm != null ? estimatedRpm.toFixed(2) : '-' },
                  { label: '自定义人数', value: customUsers != null ? `${customUsers} 人/h` : '-' },
                  { label: '自定义 RPM', value: effectiveCustomRpm != null ? effectiveCustomRpm.toFixed(2) : 'N/A' },
                  { label: '选择模型', value: selectedModel ?? '-' },
                  { label: '选择显卡', value: selectedGpu ?? '-' },
                  { label: '显卡单价', value: gpuUnitPrice != null ? fmtMoney(gpuUnitPrice) : '-' },
                ].map(({ label, value }) => (
                  <Col xs={12} sm={8} md={6} key={label}>
                    <div style={{ padding: '8px 12px', background: '#fff', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#262626' }}>{value}</div>
                    </div>
                  </Col>
                ))}
              </Row>
            </Card>
          </>
        ) : (
          <Alert
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
            message="请选择模型和显卡类型以查看估算结果"
            description="完成上方配置后，将自动计算所需显卡数量和预算"
            style={{ borderRadius: 12 }}
          />
        )}
      </div>

      {/* ── GPU 详情弹窗 ─────────────────────────────────────────────────── */}
      <Modal
        open={gpuInfoModalOpen}
        onCancel={() => setGpuInfoModalOpen(false)}
        footer={null}
        title={
          <Space>
            <ThunderboltOutlined style={{ color: '#faad14' }} />
            <span>{selectedGpu} 显卡详细信息</span>
          </Space>
        }
        width={700}
        styles={{ body: { padding: '16px 0 0' } }}
      >
        {(() => {
          if (!selectedGpu) return null
          const record = gpuInfo.records.find((r: { gpuName: string }) => r.gpuName === selectedGpu)
          const dataHeaders = gpuInfo.headers.slice(1)

          if (!record || dataHeaders.length === 0) {
            return (
              <Empty
                description={
                  gpuInfo.headers.length === 0
                    ? 'GPU 详情数据尚未配置，请在 public/data/gpu_info.csv 中填写'
                    : `未找到 ${selectedGpu} 的详情记录`
                }
                style={{ padding: '32px 0' }}
              />
            )
          }

          const infoRecord = record as { gpuName: string; fields: Record<string, string> }
          return (
            <Descriptions
              bordered
              column={1}
              size="small"
              styles={{ label: { width: 180, fontWeight: 500, background: '#fafafa' } }}
            >
              {dataHeaders.map((header: string) => (
                <Descriptions.Item key={header} label={header}>
                  {infoRecord.fields[header] || <Text type="secondary">—</Text>}
                </Descriptions.Item>
              ))}
            </Descriptions>
          )
        })()}
      </Modal>

      {/* ── 模型详情弹窗 ──────────────────────────────────────────────────── */}
      <Modal
        open={modelInfoModalOpen}
        onCancel={() => setModelInfoModalOpen(false)}
        footer={null}
        title={
          <Space>
            <RocketOutlined style={{ color: '#52c41a' }} />
            <span>{selectedModel} 模型详细信息</span>
          </Space>
        }
        width={700}
        styles={{ body: { padding: '16px 0 0' } }}
      >
        {(() => {
          if (!selectedModel) return null
          const record = modelInfo.records.find((r) => r.modelName === selectedModel)
          const dataHeaders = modelInfo.headers.slice(2)  // 跳过"模型名称"和"模型地址"列

          if (!record) {
            return (
              <Empty
                description={
                  modelInfo.headers.length === 0
                    ? '模型详情数据尚未配置，请在 public/data/model_info.csv 中填写'
                    : `未找到 ${selectedModel} 的详情记录`
                }
                style={{ padding: '32px 0' }}
              />
            )
          }

          return (
            <Descriptions
              bordered
              column={1}
              size="small"
              styles={{ label: { width: 180, fontWeight: 500, background: '#fafafa' } }}
            >
              {/* 模型地址行：支持多链接点击跳转 */}
              <Descriptions.Item label={modelInfo.headers[1] ?? '模型地址'}>
                {record.urls.length === 0 ? (
                  <Text type="secondary">—</Text>
                ) : (
                  <Space wrap>
                    {record.urls.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ wordBreak: 'break-all' }}
                      >
                        {url}
                      </a>
                    ))}
                  </Space>
                )}
              </Descriptions.Item>
              {/* 其余扩展字段 */}
              {dataHeaders.map((header) => (
                <Descriptions.Item key={header} label={header}>
                  {record.fields[header] || <Text type="secondary">—</Text>}
                </Descriptions.Item>
              ))}
            </Descriptions>
          )
        })()}
      </Modal>
    </div>
  )
}
