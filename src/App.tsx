import { ConfigProvider, Layout, Typography } from 'antd'
import zhCN from 'antd/locale/zh_CN'

const { Header, Content, Footer } = Layout
const { Title, Text } = Typography

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ display: 'flex', alignItems: 'center' }}>
          <Title level={3} style={{ color: '#fff', margin: 0 }}>
            CoStrict AS
          </Title>
        </Header>
        <Content style={{ padding: '24px', flex: 1 }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 8, minHeight: 360 }}>
            <Title level={4}>欢迎使用</Title>
            <Text type="secondary">项目已成功初始化，可以开始编写你的 UI 界面。</Text>
          </div>
        </Content>
        <Footer style={{ textAlign: 'center' }}>
          CoStrict AS ©{new Date().getFullYear()} 基于 React + Vite + Ant Design
        </Footer>
      </Layout>
    </ConfigProvider>
  )
}

export default App
