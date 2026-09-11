import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE, useAuth } from '../context/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Mail, Briefcase, MapPin, Calendar, User as UserIcon, ShieldCheck, Edit3, Sparkles, Building2,
  Link2, Unlink, Loader2, CheckCircle2, AlertCircle, Hash
} from 'lucide-react';

const ProfileView = ({ onEditClick }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { token, user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetUserId = searchParams.get('userId') || searchParams.get('id');
  const isOwnProfile = !targetUserId || targetUserId === currentUser?._id;

  // Google Calendar sync (spec section 15)
  const [calendarStatus, setCalendarStatus] = useState({ featureEnabled: false, connected: false });
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarActionLoading, setCalendarActionLoading] = useState(false);
  const [calendarToast, setCalendarToast] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, [token, targetUserId]);

  useEffect(() => {
    if (isOwnProfile) {
      fetchCalendarStatus();
    } else {
      setCalendarLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, targetUserId, isOwnProfile]);

  // Handle the redirect back from Google's OAuth consent screen
  // (backend sends the browser to /profile?calendar=connected|error)
  useEffect(() => {
    const calendarResult = searchParams.get('calendar');
    if (calendarResult === 'connected') {
      setCalendarToast('Google Calendar connected successfully!');
      fetchCalendarStatus();
      setSearchParams({}, { replace: true });
    } else if (calendarResult === 'error') {
      setCalendarToast('Failed to connect Google Calendar. Please try again.');
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!calendarToast) return;
    const t = setTimeout(() => setCalendarToast(null), 4000);
    return () => clearTimeout(t);
  }, [calendarToast]);

  const fetchProfile = async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      if (!isOwnProfile && targetUserId) {
        const response = await axios.get(`${API_BASE}/users/${targetUserId}/overview`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setProfile(response.data?.user || response.data);
      } else {
        const response = await axios.get(`${API_BASE}/users/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setProfile(response.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCalendarStatus = async () => {
    if (!token) return;
    setCalendarLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/calendar/google/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCalendarStatus(res.data);
    } catch (err) {
      console.error('Failed to fetch calendar status', err);
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleConnectCalendar = async () => {
    setCalendarActionLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/calendar/google/auth-url`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      window.location.href = res.data.url;
    } catch (err) {
      setCalendarToast(err.response?.data?.error || 'Could not start Google Calendar connection.');
      setCalendarActionLoading(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    setCalendarActionLoading(true);
    try {
      await axios.post(
        `${API_BASE}/calendar/google/disconnect`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCalendarToast('Google Calendar disconnected.');
      fetchCalendarStatus();
    } catch (err) {
      setCalendarToast('Failed to disconnect Google Calendar.');
    } finally {
      setCalendarActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-8 text-center text-slate-500 dark:text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-500 mb-2" />
        <p className="text-sm font-medium">Loading profile data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-6 md:p-10 max-w-xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 p-6 rounded-2xl flex items-center gap-4">
          <AlertCircle size={24} className="shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto space-y-6 text-slate-900 dark:text-slate-100">
      {calendarToast && (
        <div className="fixed bottom-6 right-6 z-[200] flex items-center gap-2 px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white shadow-2xl text-sm">
          <CheckCircle2 size={16} className="text-emerald-500" />
          {calendarToast}
        </div>
      )}

      {/* Header Profile Card */}
      <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">

          {/* User Info & Avatar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="relative shrink-0">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-950 border-2 border-emerald-500/40 flex items-center justify-center shadow-md">
                {profile?.profilePhoto ? (
                  <img
                    src={profile.profilePhoto}
                    alt={profile?.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    {profile?.name?.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                  {profile?.name}
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck size={14} />
                  {profile?.role ? profile.role.toUpperCase() : 'MEMBER'}
                </span>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2 font-medium">
                <Mail size={15} className="text-slate-400 dark:text-slate-500" />
                {profile?.email}
              </p>
            </div>
          </div>

          {/* Action Button */}
          {isOwnProfile ? (
            <button
              onClick={() => onEditClick ? onEditClick() : navigate('/profile/edit')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md shadow-emerald-500/20 transition-all duration-200 active:scale-[0.98]"
            >
              <Edit3 size={16} />
              <span>Edit Profile</span>
            </button>
          ) : (
            <button
              onClick={() => navigate('/chat')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md shadow-emerald-500/20 transition-all duration-200 active:scale-[0.98]"
            >
              <span>Message Employee</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid Content Sections */}
      <div className="grid md:grid-cols-2 gap-6">

        {/* Personal Info Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 pb-4 mb-5 border-b border-slate-200 dark:border-slate-800">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <UserIcon size={18} />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Personal Information
            </h2>
          </div>

          <div className="space-y-3">
            <DetailItem
              icon={<UserIcon size={16} />}
              label="Full Name"
              value={profile?.name}
            />
            <DetailItem
              icon={<Calendar size={16} />}
              label="Date of Birth"
              value={profile?.dob ? new Date(profile.dob).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : null}
            />
            <DetailItem
              icon={<Sparkles size={16} />}
              label="Gender"
              value={profile?.gender}
            />
          </div>
        </div>

        {/* Professional Info Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 pb-4 mb-5 border-b border-slate-200 dark:border-slate-800">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Briefcase size={18} />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Professional Details
            </h2>
          </div>

          <div className="space-y-3">
            <DetailItem
              icon={<Hash size={16} />}
              label="Identity / Employee ID"
              value={profile?.employeeId}
            />
            <DetailItem
              icon={<Briefcase size={16} />}
              label="Role / Designation"
              value={profile?.designationRole}
            />
            <DetailItem
              icon={<Building2 size={16} />}
              label="Department"
              value={profile?.department}
            />
            <DetailItem
              icon={<MapPin size={16} />}
              label="Work Location"
              value={profile?.workLocation}
            />
          </div>
        </div>

      </div>

      {/* Calendar Sync (Self Profile Only) */}
      {isOwnProfile && !calendarLoading && calendarStatus.featureEnabled && (
        <div className="pt-4">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Integrations</h3>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 rounded-xl border border-slate-200 dark:border-slate-700/50">
                <Calendar size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Google Calendar</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
                  {calendarStatus.connected
                    ? 'Your tasks are synced to your Google Calendar.'
                    : 'Connect your Google account to see task deadlines on your calendar.'}
                </p>
              </div>
            </div>

            {calendarStatus.connected ? (
              <button
                onClick={handleDisconnectCalendar}
                disabled={calendarActionLoading}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-50 rounded-xl transition-colors"
              >
                {calendarActionLoading ? <Loader2 size={14} className="animate-spin" /> : <Unlink size={14} />}
                Disconnect
              </button>
            ) : (
              <button
                onClick={handleConnectCalendar}
                disabled={calendarActionLoading}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl transition-colors shadow-sm"
              >
                {calendarActionLoading ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                Connect
              </button>
            )}
          </div>
        </div>
      )}

      {isOwnProfile && !calendarLoading && !calendarStatus.featureEnabled && (
        <div className="pt-4">
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs">
            <AlertCircle size={15} className="shrink-0 mt-0.5 text-slate-500 dark:text-slate-400" />
            <span>Google Calendar sync has not been enabled by your administrator yet.</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Refined Detail Row Sub-component
const DetailItem = ({ icon, label, value }) => (
  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 transition-colors">
    <div className="flex items-center gap-3">
      <div className="text-slate-500 dark:text-slate-400">
        {icon}
      </div>
      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{label}</span>
    </div>
    <span className={`text-xs sm:text-sm font-semibold ${value ? 'text-slate-900 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500 italic'}`}>
      {value || 'Not provided'}
    </span>
  </div>
);

export default ProfileView;