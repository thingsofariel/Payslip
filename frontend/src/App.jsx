// src/App.jsx

import { useAuth } from './AuthContext';
import LoginPage from './pages/LoginPage';
import EmployeePortal from './pages/EmployeePortal';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  const { token, employee } = useAuth();

  if (!token || !employee) {
    return <LoginPage />;
  }

  // Role comes from the verified JWT payload returned at login -- the
  // same req.user.role the backend's authorize() middleware checks.
  // This routing is a UI convenience only, not a security boundary:
  // the real enforcement lives server-side, so even if someone hacked
  // this condition in their browser, every actual data-changing
  // request would still be rejected by the backend's RBAC middleware.
  return employee.role === 'ADMIN_HR' ? <AdminDashboard /> : <EmployeePortal />;
}
