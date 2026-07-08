// src/App.jsx

import { useAuth } from './AuthContext';
import LoginPage from './pages/LoginPage';
import EmployeePortal from './pages/EmployeePortal';
import AdminDashboard from './pages/AdminDashboard';
import SharedPayslipView from './pages/SharedPayslipView';

export default function App() {
  const { token, employee } = useAuth();

  // Shareable payslip links look like /slip/<token> -- this is a deep
  // link a manager pastes into WhatsApp, so it must survive straight
  // through the login gate below rather than always landing on the
  // dashboard/portal after auth.
  const shareMatch = window.location.pathname.match(/^\/slip\/([a-f0-9]+)$/);

  if (!token || !employee) {
    return <LoginPage />;
  }

  if (shareMatch) {
    return <SharedPayslipView shareToken={shareMatch[1]} />;
  }

  // Role comes from the verified JWT payload returned at login -- the
  // same req.user.role the backend's authorize() middleware checks.
  // This routing is a UI convenience only, not a security boundary:
  // the real enforcement lives server-side, so even if someone hacked
  // this condition in their browser, every actual data-changing
  // request would still be rejected by the backend's RBAC middleware.
  return employee.role === 'ADMIN_HR' ? <AdminDashboard /> : <EmployeePortal />;
}
