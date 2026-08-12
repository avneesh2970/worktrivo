import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { API_BASE, useAuth } from '../context/AuthContext';
import { 
  Upload, 
  Loader2, 
  User, 
  Briefcase, 
  Camera, 
  X, 
  Save, 
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const ProfileSetup = ({ onCancel, onSuccess }) => {
  const { token, setUser } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    dob: '',
    gender: '',
    department: '',
    workLocation: '',
    designationRole: '',
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (token) fetchCurrentProfile();
  }, [token]);

  const fetchCurrentProfile = async () => {
    try {
      const res = await axios.get(`${API_BASE}/users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.data;
      setFormData({
        name: data.name || '',
        dob: data.dob ? new Date(data.dob).toISOString().split('T')[0] : '',
        gender: data.gender || '',
        department: data.department || '',
        workLocation: data.workLocation || '',
        designationRole: data.designationRole || '',
      });
      if (data.profilePhoto) setPreviewUrl(data.profilePhoto);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load profile data.' });
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, val]) => data.append(key, val));
      if (selectedFile) data.append('profilePhoto', selectedFile);

      await axios.put(`${API_BASE}/users/profile`, data, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      const me = await axios.get(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(me.data.user);

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      toast.success('Profile saved successfully!');

      if (onSuccess) onSuccess();

      setTimeout(() => {
        navigate('/profile');
      }, 1500);
    } catch (err) {
      toast.error('Failed to update profile.');
      setMessage({ type: 'error', text: 'Failed to update profile details.' });
    } finally {
      setLoading(false);
    }
  };

  // Loader state
  if (fetching) {
    return (
      <div className="flex-1 p-6 md:p-10 max-w-6xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl bg-[#171d33] border border-slate-700/60 text-slate-300">
          <Loader2 className="animate-spin text-[#dc9750]" size={18} />
          <span className="text-sm font-medium">Fetching profile details...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto space-y-6 text-slate-100">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-700/60">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Edit Profile
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Keep your personal and professional details up to date.
          </p>
        </div>

        <button
          type="button"
          onClick={onCancel || (() => navigate('/profile'))}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#171d33] hover:bg-slate-800 text-slate-300 text-sm font-medium border border-slate-700/60 transition duration-200 cursor-pointer"
        >
          <X size={16} />
          <span>Cancel</span>
        </button>
      </div>

      {/* Single Unified Card */}
      <div className="bg-[#171d33] border border-slate-700/60 rounded-xl overflow-hidden shadow-xl">
        <form onSubmit={handleSubmit}>
          {/* Main Content Layout: Photo (Left/Top) | Personal & Professional Details (Right Column) */}
          <div className="p-6 md:p-8 flex flex-col lg:flex-row gap-8">
            
            {/* Left/Top Section: Profile Photo */}
            <div className="lg:w-1/4 flex flex-col items-center lg:border-r border-slate-700/60 lg:pr-8">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 w-full text-center lg:text-left">
                Profile Photo
              </label>

              <div className="flex flex-col items-center gap-4 w-full">
                <div className="relative group">
                  <div className="relative w-32 h-32 rounded-xl overflow-hidden bg-[#1e2640] border border-dashed border-slate-600 group-hover:border-[#dc9750] transition duration-200 flex items-center justify-center">
                    {previewUrl ? (
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-slate-400">
                        <Upload size={24} />
                        <span className="text-[10px] uppercase font-bold tracking-wider">Upload</span>
                      </div>
                    )}

                    {/* Overlay trigger */}
                    <label className="absolute inset-0 bg-[#1e2640]/80 opacity-0 group-hover:opacity-100 transition duration-200 flex flex-col items-center justify-center cursor-pointer text-white gap-1">
                      <Camera size={20} className="text-[#dc9750]" />
                      <span className="text-xs font-medium">Change</span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          setSelectedFile(file);
                          setPreviewUrl(URL.createObjectURL(file));
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-1 text-center">
                  <h3 className="text-sm font-semibold text-slate-200">Upload new picture</h3>
                  <p className="text-xs text-slate-400 max-w-[200px]">
                    JPG, PNG, or WEBP. Aspect ratio 1:1.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Section: Form Fields in Horizontal Sections */}
            <div className="lg:w-3/4 space-y-8">
              
              {/* Personal Identity Row */}
              <div className="space-y-4">
                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-700/60">
                  <User size={18} className="text-[#dc9750]" />
                  <h2 className="text-sm font-semibold text-white">Personal Identity</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="Full Name"
                    name="name"
                    placeholder="e.g. Alex Morgan"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                  <Input
                    label="Date of Birth"
                    type="date"
                    name="dob"
                    value={formData.dob}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                  />
                  <Select
                    label="Gender"
                    name="gender"
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    options={['Male', 'Female', 'Other', 'Prefer not to say']}
                  />
                </div>
              </div>

              {/* Professional Details Row */}
              <div className="space-y-4">
                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-700/60">
                  <Briefcase size={18} className="text-[#dc9750]" />
                  <h2 className="text-sm font-semibold text-white">Professional Details</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="Job Title / Designation"
                    name="designationRole"
                    placeholder="e.g. Senior Software Engineer"
                    value={formData.designationRole}
                    onChange={(e) => setFormData({ ...formData, designationRole: e.target.value })}
                  />
                  <Input
                    label="Department"
                    name="department"
                    placeholder="e.g. Product Development"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  />
                  <Input
                    label="Work Location"
                    name="workLocation"
                    placeholder="e.g. San Francisco / Remote"
                    value={formData.workLocation}
                    onChange={(e) => setFormData({ ...formData, workLocation: e.target.value })}
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Integrated Action Footer Inside the Single Card */}
          <div className="px-6 py-4 bg-[#14192d] border-t border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              {message.text && (
                <div className={`flex items-center gap-2 text-xs font-medium ${message.type === 'error' ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {message.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
                  <span>{message.text}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onCancel || (() => navigate('/profile'))}
                className="px-4 py-2 text-slate-300 hover:text-white rounded-xl font-medium text-sm transition duration-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#dc9750] hover:bg-[#e3a35f] text-slate-950 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-50 cursor-pointer shadow-md shadow-[#dc9750]/10"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

ProfileSetup.propTypes = {
  onCancel: PropTypes.func,
  onSuccess: PropTypes.func,
};

// Clean Form Inputs
const Input = ({ label, ...props }) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-medium text-slate-300">{label}</label>
    <input
      {...props}
      className="w-full bg-[#1e2640] border border-slate-700/80 focus:border-[#dc9750] rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#dc9750] transition duration-200"
    />
  </div>
);

Input.propTypes = {
  label: PropTypes.string.isRequired,
};

const Select = ({ label, options, ...props }) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-medium text-slate-300">{label}</label>
    <select
      {...props}
      className="w-full bg-[#1e2640] border border-slate-700/80 focus:border-[#dc9750] rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#dc9750] transition duration-200"
    >
      <option value="" className="bg-[#171d33] text-slate-400">Select...</option>
      {options.map((opt) => (
        <option key={opt} value={opt} className="bg-[#171d33] text-slate-200">
          {opt}
        </option>
      ))}
    </select>
  </div>
);

Select.propTypes = {
  label: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(PropTypes.string).isRequired,
};

export default ProfileSetup;