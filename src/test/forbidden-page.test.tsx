import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ForbiddenPage } from '@/pages/Error/ForbiddenPage';

function LocationTracker() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
}

function renderForbiddenPage(initialEntry = '/403') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationTracker />
      <Routes>
        <Route path="/403" element={<ForbiddenPage />} />
        <Route path="/dashboard" element={<div data-testid="dashboard-view">控制台首页</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ForbiddenPage (403 无权限页面)', () => {
  it('渲染 403 关键文案与说明信息', () => {
    renderForbiddenPage();

    expect(screen.getByRole('heading', { level: 3, name: '403' })).toBeInTheDocument();
    expect(screen.getByText('抱歉，您没有权限访问此页面 (ACCESS_DENIED)')).toBeInTheDocument();
  });

  it('存在「返回首页」按钮，且点击后导航至 /dashboard', () => {
    renderForbiddenPage();

    expect(screen.getByTestId('location-display')).toHaveTextContent('/403');

    const homeButton = screen.getByRole('button', { name: '返回首页' });
    expect(homeButton).toBeInTheDocument();

    fireEvent.click(homeButton);

    expect(screen.getByTestId('location-display')).toHaveTextContent('/dashboard');
    expect(screen.getByTestId('dashboard-view')).toBeInTheDocument();
  });
});
