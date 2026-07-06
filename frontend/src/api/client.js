// src/api/client.js
//
// Thin wrapper around fetch for talking to the real Payslip API
// (the Express server built earlier, running on localhost:3000).
//
// The JWT is kept in memory only (passed in by the caller), never in
// localStorage — this mirrors the same reasoning as the backend's
// own security posture: payroll data deserves a clean logout that
// actually clears the token, not one that just removes a UI element
// while the token quietly persists in browser storage.

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    // This specifically catches "the server isn't reachable at all"
    // (wrong port, server not running, CORS misconfigured) -- distinct
    // from a real API error response, which we handle below. Surfacing
    // this distinctly matters: a person debugging "why didn't this
    // work" needs to know whether the server responded with a real
    // error or never responded at all.
    throw new ApiError(
      'Cannot reach the API server. Is it running on ' + BASE_URL + '?',
      0,
      null
    );
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    // Surface the backend's actual error message (e.g. "You do not
    // have permission to perform this action.") rather than a generic
    // "request failed" -- the backend already wrote good, specific
    // error messages; don't discard them here.
    throw new ApiError(data?.error || `Request failed with status ${response.status}`, response.status, data);
  }

  return data;
}

export const api = {
  login: (email, password) =>
    request('/api/auth/login', { method: 'POST', body: { email, password } }),

  getMyProfile: (token) => request('/api/employees/me', { token }),

  listPayslips: (token, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/payslips${query ? `?${query}` : ''}`, { token });
  },

  getPayslip: (token, payslipId) => request(`/api/payslips/${payslipId}`, { token }),

  getPayslipPdfUrl: (payslipId) => `${BASE_URL}/api/payslips/${payslipId}/pdf`,

  createPayslip: (token, payslipData) =>
    request('/api/payslips', { method: 'POST', token, body: payslipData }),

  finalizePayslip: (token, payslipId) =>
    request(`/api/payslips/${payslipId}/finalize`, { method: 'PATCH', token }),

  markPayslipSent: (token, payslipId) =>
    request(`/api/payslips/${payslipId}/mark-sent`, { method: 'PATCH', token }),

  listEmployees: (token) => request('/api/employees', { token }),

  createEmployee: (token, employeeData) =>
    request('/api/employees', { method: 'POST', token, body: employeeData }),

  updateEmployee: (token, employeeId, employeeData) =>
    request(`/api/employees/${employeeId}`, { method: 'PATCH', token, body: employeeData }),

  deleteEmployee: (token, employeeId) =>
    request(`/api/employees/${employeeId}`, { method: 'DELETE', token }),
};

export { ApiError };
