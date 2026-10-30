import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background text-text-primary flex">
      {/* Fixed left sidebar 220px */}
      <aside className="w-[220px] fixed top-0 bottom-0 left-0 bg-surface border-r border-border p-6 flex flex-col justify-between z-10">
        <div>
          <h1 className="text-xl font-semibold text-text-primary tracking-tight mb-8">
            Habit Tracker
          </h1>

          <nav className="flex flex-col space-y-2">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `text-sm py-2 px-3 rounded-md transition-colors ${
                  isActive
                    ? 'text-text-primary font-medium bg-surface-elevated'
                    : 'text-text-muted hover:text-text-primary'
                }`
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/habits"
              className={({ isActive }) =>
                `text-sm py-2 px-3 rounded-md transition-colors ${
                  isActive
                    ? 'text-text-primary font-medium bg-surface-elevated'
                    : 'text-text-muted hover:text-text-primary'
                }`
              }
            >
              Habits
            </NavLink>
          </nav>
        </div>

        {/* Pinned user info and logout at bottom */}
        <div className="pt-4 border-t border-border flex flex-col space-y-2">
          {user && (
            <div className="text-xs text-text-primary font-medium truncate">
              {user.firstName} {user.lastName}
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="text-xs text-left text-text-muted hover:text-text-primary transition-colors cursor-pointer py-1"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <main className="ml-[220px] flex-1 p-8 md:p-12 max-w-[1100px]">
        <Outlet />
      </main>
    </div>
  );
};
