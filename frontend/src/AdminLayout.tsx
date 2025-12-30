import React, { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from './pages/admin/AdminSidebar';

const AdminLayout: React.FC<{ children?: ReactNode }> = ({ children }) => (
  <AdminSidebar>
    <div className='flex-1 min-h-screen bg-linear-to-br from-slate-50 to-blue-50/30'>
      <div className='mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8'>
        {children ? children : <Outlet />}
      </div>
    </div>
  </AdminSidebar>
);

export default AdminLayout;