import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import RequireAuth from '../components/RequireAuth';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setAvatarUrl(user.avatarUrl || '');
    }
  }, [user]);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErr('Image file size must be less than 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarUrl(reader.result);
      setErr('');
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    setErr('');

    try {
      const res = await api.patch('/users/profile', {
        name: name.trim(),
        avatarUrl: avatarUrl.trim() || null,
      });

      updateUser(res.data);
      setMsg('Profile updated successfully!');
    } catch (error) {
      setErr(error.response?.data?.error || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const initialLetter = ((name || user?.email || 'U').charAt(0) || 'U').toUpperCase();

  return (
    <RequireAuth>
      <DashboardLayout>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
          <div className="card" style={{ background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>My Profile</h2>
            <p style={{ color: '#6b7280', marginBottom: 24 }}>
              Update your personal profile details and upload a photo to display across Exam Flow.
            </p>

            {msg && <div style={{ background: '#ecfdf5', color: '#047857', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>{msg}</div>}
            {err && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>{err}</div>}

            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
                <div
                  style={{
                    width: 110,
                    height: 110,
                    borderRadius: '50%',
                    background: 'var(--accent, #6366f1)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 40,
                    fontWeight: 700,
                    overflow: 'hidden',
                    marginBottom: 16,
                    border: '4px solid #e0e7ff',
                    boxShadow: '0 4px 12px rgba(99,102,241,0.2)',
                  }}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    initialLetter
                  )}
                </div>

                <label
                  className="btn btn-secondary"
                  style={{ cursor: 'pointer', padding: '8px 16px', fontSize: 14, borderRadius: 8 }}
                >
                  📷 Choose Profile Picture
                  <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                </label>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl('')}
                    style={{ background: 'none', border: 'none', color: '#ef4444', marginTop: 8, fontSize: 13, cursor: 'pointer' }}
                  >
                    Remove Photo
                  </button>
                )}
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d5db' }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  value={user?.email || ''}
                  disabled
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#6b7280' }}
                />
                <span style={{ fontSize: 12, color: '#9ca3af', marginTop: 4, display: 'block' }}>
                  Email address cannot be changed.
                </span>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
                style={{ width: '100%', padding: '12px', fontSize: 16, fontWeight: 600, borderRadius: 8 }}
              >
                {saving ? 'Saving Changes...' : 'Save Profile Changes'}
              </button>
            </form>
          </div>
        </div>
      </DashboardLayout>
    </RequireAuth>
  );
}
