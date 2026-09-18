import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { NotFoundPage } from '@/pages/Error/NotFoundPage';

function LocationTracker() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
}

function renderNotFoundPage(initialEntry = '/404') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationTracker />
      <Routes>
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="/dashboard" element={<div data-testid="dashboard-view">控制台首页</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NotFoundPage (404 未找到页面)', () => {
  it('渲染 404 关键文案与说明信息', () => {
    renderNotFoundPage();

    expect(screen.getByRole('heading', { level: 3, name: '404' })).toBeInTheDocument();
    expect(screen.getByText('抱歉，您访问的页面不存在 (NOT_FOUND)')).toBeInTheDocument();
  });

  it('存在「返回首页」按钮，且点击后导航至 /dashboard', () => {
    renderNotFoundPage();

    expect(screen.getByTestId('location-display')).toHaveTextContent('/404');

    const homeButton = screen.getByRole('button', { name: '返回首页' });
    expect(homeButton).toBeInTheDocument();

    fireEvent.click(homeButton);

    expect(screen.getByTestId('location-display')).toHaveTextContent('/dashboard');
    expect(screen.getByTestId('dashboard-view')).toBeInTheDocument();
  });
});
