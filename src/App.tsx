import { ConfigProvider, Layout, Typography } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import ResourceEstimator from './pages/ResourceEstimator'

const { Header, Content, Footer } = Layout
const { Title } = Typography

function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 8,
        },
      }}
    >
      <Layout style={{ minHeight: '100vh', background: '#f5f7fa' }}>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#001529',
            padding: '0 24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <Title level={4} style={{ color: '#fff', margin: 0, letterSpacing: 1 }}>
            🖥️ CoStrict AS · 智算资源平台
          </Title>
        </Header>

        <Content style={{ padding: '0', flex: 1 }}>
          <ResourceEstimator />
        </Content>

        <Footer
          style={{
            textAlign: 'center',
            background: '#f5f7fa',
            color: '#8c8c8c',
            fontSize: 13,
            borderTop: '1px solid #e8e8e8',
          }}
        >
          CoStrict AS ©{new Date().getFullYear()} · GPU 资源预估计算器
        </Footer>
      </Layout>
    </ConfigProvider>
  )
}

export default App
