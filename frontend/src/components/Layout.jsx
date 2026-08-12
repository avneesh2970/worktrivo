import React, { useState, useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

const Layout = () => {
  const { user, loading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };

  // Close mobile sidebar automatically on route changes
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  // Prevent background body scroll when mobile drawer is open
  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isSidebarOpen]);

  // Loading Screen using accent #dc9750
  if (loading) {
    return (
      <div 
        className="flex h-[100dvh] w-full flex-col items-center justify-center gap-4 bg-[#070a13] text-gray-300"
        role="status"
        aria-live="polite"
      >
        <div className="relative flex items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/5 border-t-[#dc9750]" />
          <div className="absolute h-6 w-6 rounded-full bg-[#dc9750]/10 blur-sm" />
        </div>
        <p className="text-sm font-medium tracking-wide text-gray-400">
          Loading TaskSphere...
        </p>
      </div>
    );
  }

  // Redirect unauthenticated users
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Full-bleed views (like chat) bypass default content padding
  const isFullBleedView = location.pathname.startsWith('/chat');

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#070a13] text-gray-100 antialiased selection:bg-[#dc9750]/30 selection:text-[#dc9750]">
      {/* Sidebar - Floating/Sticky on Desktop, Collapsible Drawer on Mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 h-[100dvh] w-64 shrink-0 transform border-r border-white/5 bg-[#0d1426] shadow-2xl transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:z-auto lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Main Navigation"
      >
        <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
      </aside>

      {/* Mobile Backdrop with Smooth Fade */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={toggleSidebar}
        aria-hidden="true"
      />

      {/* Main Viewport Container */}
      <div className="flex h-[100dvh] min-w-0 flex-1 flex-col overflow-hidden">
        <Navbar toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
        
        <main
          className={`flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent ${
            isFullBleedView
              ? 'p-0'
              : 'p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto'
          }`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;