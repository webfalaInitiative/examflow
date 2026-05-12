import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import RequireAuth from '../components/RequireAuth';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!user) return;
    api.get('/users').then(r => setUsers(r.data)).catch(() => {});
  }, [user]);

  const changeRole = async (userId, newRole) => {
    if (!confirm(`Change this user's role to ${newRole}?`)) return;
    try {
      await api.patch(`/users/${userId}/role`, { role: newRole });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update role');
    }
  };

  const deleteUser = async (userId) => {
    if (!confirm('Delete this user and all their submissions?')) return;
    try {
      await api.delete(`/users/${userId}`);
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete');
    }
  };

  const isOwner = user?.role === 'OWNER';

  return (
    <RequireAuth>
    <DashboardLayout>
      <div className="page-header">
        <h1>Users</h1>
        <p>Manage registered users and their roles</p>
      </div>

      <div className="panel">
        <div className="panel-body no-pad">
          {users.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <p>No users found</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Account</th>
                  <th>Joined</th>
                  {isOwner && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="user-avatar" style={{ width: 30, height: 30, fontSize: 12 }}>
                          {(u.name || u.email)[0].toUpperCase()}
                        </div>
                        <strong>{u.name || '—'}</strong>
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`badge ${u.role === 'OWNER' ? 'red' : u.role === 'ADMIN' ? 'blue' : 'green'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.accountStatus === 'ACTIVE' ? 'green' : u.accountStatus === 'PENDING' ? 'orange' : 'red'}`}>
                        {u.accountStatus || 'ACTIVE'}
                      </span>
                    </td>
                    <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                    {isOwner && (
                      <td>
                        {u.id !== user?.id && u.role !== 'OWNER' && (
                          <div className="btn-group">
                            {u.role === 'STUDENT' && (
                              <button className="btn-sm btn-outline" onClick={() => changeRole(u.id, 'ADMIN')}>
                                Make Admin
                              </button>
                            )}
                            {u.role === 'ADMIN' && (
                              <button className="btn-sm btn-outline" onClick={() => changeRole(u.id, 'STUDENT')}>
                                Make Student
                              </button>
                            )}
                            <button className="btn-sm btn-danger" onClick={() => deleteUser(u.id)}>
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
    </RequireAuth>
  );
}
