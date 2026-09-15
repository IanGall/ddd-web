import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, message, Popconfirm, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { authApi } from '@/api/auth';
import type { AuthSessionDTO } from '@/api/types';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';

const { Title, Text } = Typography;

export const SessionsPage: React.FC = () => {
  const [sessions, setSessions] = useState<AuthSessionDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const clearAuth = useAuthStore((state) => state.clear);
  const navigate = useNavigate();

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authApi.getSessions();
      setSessions(data);
    } catch (err) {
      console.error('获取会话列表失败', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleRevoke = async (sessionId: string) => {
    try {
      await authApi.revokeSession(sessionId);
      message.success('已吊销该会话');
      fetchSessions();
    } catch (err) {
      console.error('吊销会话失败', err);
    }
  };

  const handleLogoutAll = async () => {
    try {
      await authApi.logoutAll();
      message.success('已强制登出全部会话');
      clearAuth();
      navigate('/login');
    } catch (err) {
      console.error('登出全部会话失败', err);
    }
  };

  const columns: ColumnsType<AuthSessionDTO> = [
    {
      title: '客户端类型',
      dataIndex: 'clientType',
      key: 'clientType',
      render: (clientType: string) => <Tag color="blue">{clientType}</Tag>,
    },
    {
      title: '来源 IP',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
    },
    {
      title: '设备识别码',
      dataIndex: 'deviceId',
      key: 'deviceId',
      ellipsis: true,
    },
    {
      title: '创建时间 (UTC)',
      dataIndex: 'createdAt',
      key: 'createdAt',
    },
    {
      title: '状态',
      key: 'current',
      render: (_, record) =>
        record.current ? <Tag color="green">当前设备</Tag> : <Tag color="default">其它终端</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          {!record.current && (
            <Popconfirm
              title="确定要吊销该设备会话吗？"
              onConfirm={() => handleRevoke(record.sessionId)}
              okText="吊销"
              cancelText="取消"
            >
              <Button type="link" danger size="small">
                吊销
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0 }}>
            我的会话
          </Title>
          <Text type="secondary">查看已建立登录会话并可随时吊销非本设备登录</Text>
        </div>
        <Space>
          <Button onClick={fetchSessions} loading={loading}>
            刷新
          </Button>
          <Popconfirm
            title="确定要强制登出全部会话吗？本设备也需重新登录。"
            onConfirm={handleLogoutAll}
            okText="确定登出"
            cancelText="取消"
          >
            <Button danger>登出全部会话</Button>
          </Popconfirm>
        </Space>
      </div>

      <Table
        rowKey="sessionId"
        columns={columns}
        dataSource={sessions}
        loading={loading}
        pagination={false}
      />
    </Card>
  );
};
