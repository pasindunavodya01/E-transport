import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LogOut, ShieldCheck, CheckCircle, XCircle, FileText, User } from 'lucide-react';

export default function AdminDashboard() {
  const [profile, setProfile] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewNotes, setReviewNotes] = useState({});

  const navigate = useNavigate();

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const token = localStorage.getItem('userToken');
        if (!token) return navigate('/login');

        const { data: userData } = await axios.get(`${import.meta.env.VITE_API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (userData.role !== 'admin') {
          return navigate('/login');
        }
        setProfile(userData);

        const { data: driversData } = await axios.get(`${import.meta.env.VITE_API_URL.replace('/api', '')}/api/payments/admin/all-payments`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setDrivers(driversData || []);
      } catch (error) {
        console.error('Error fetching admin data', error);
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchAdminData();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userRole');
    navigate('/login');
  };

  const reviewPayment = async (driverId, paymentId, status) => {
    try {
      const token = localStorage.getItem('userToken');
      await axios.put(
        `${import.meta.env.VITE_API_URL.replace('/api', '')}/api/payments/admin/review/${driverId}/${paymentId}`,
        { status, note: reviewNotes[paymentId] || '' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Refresh list
      const { data: driversData } = await axios.get(`${import.meta.env.VITE_API_URL.replace('/api', '')}/api/payments/admin/all-payments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDrivers(driversData || []);
    } catch (err) {
      console.error(err);
      alert('Failed to update payment status.');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-brand-light text-brand text-xl">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <nav className="bg-brand text-white shadow-md w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <ShieldCheck className="w-6 h-6" /> System Admin Dashboard
            </h1>
            <button onClick={handleLogout} className="flex items-center gap-2 hover:bg-brand-dark px-3 py-2 rounded-lg transition-colors">
              <LogOut className="w-5 h-5" /> Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
          <div className="p-6 md:p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome, {profile?.name}</h2>
            <p className="text-gray-500">Monitor all drivers and review their monthly system payments.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 md:p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
              <User className="w-6 h-6 text-brand" /> Registered Drivers
            </h3>
            <p className="text-sm text-gray-500 mb-6">Review system fee receipt submissions from each driver.</p>

            {drivers.length === 0 ? (
              <div className="text-center py-10 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-gray-500">No drivers are currently active in the system.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {drivers.map(driver => (
                  <div key={driver.driverId} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center flex-wrap gap-4">
                      <div>
                        <h4 className="font-bold text-lg text-gray-900">{driver.name}</h4>
                        <div className="text-sm text-gray-600 flex items-center gap-3 mt-1">
                          <span>{driver.email}</span>
                          <span className="w-1.5 h-1.5 bg-gray-300 rounded-full"></span>
                          <span className="font-mono bg-white px-2 py-0.5 rounded border border-gray-200">{driver.vehicleNumber}</span>
                        </div>
                      </div>
                      <div className="text-sm font-semibold bg-white border border-gray-200 px-3 py-1 rounded-full text-brand">
                        Total Uploads: {driver.payments?.length || 0}
                      </div>
                    </div>

                    <div className="p-6">
                      {!driver.payments || driver.payments.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">No payments uploaded by this driver yet.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {driver.payments.map(pay => (
                            <div key={pay._id} className={`border rounded-xl p-4 relative overflow-hidden ${
                              pay.status === 'approved' ? 'bg-green-50/30 border-green-200' :
                              pay.status === 'rejected' ? 'bg-red-50/30 border-red-200' :
                              'bg-white border-gray-200'
                            }`}>
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">Month</div>
                                  <div className="font-bold text-gray-900">{pay.month}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">Amount</div>
                                  <div className="font-bold text-brand">LKR {pay.amount}</div>
                                </div>
                              </div>
                              
                              <div className="aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden mb-4 relative cursor-pointer border border-gray-200 flex items-center justify-center" onClick={() => window.open(pay.imageUrl, '_blank')}>
                                {pay.imageUrl ? (
                                  <img src={pay.imageUrl} alt="Receipt" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                                ) : (
                                  <FileText className="w-8 h-8 text-gray-400" />
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <span className="text-white text-sm font-bold bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">View Receipt</span>
                                </div>
                              </div>

                              <div className="mb-4">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                                  pay.status === 'approved' ? 'bg-green-100 text-green-700' :
                                  pay.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {pay.status === 'approved' && <CheckCircle className="w-3.5 h-3.5" />}
                                  {pay.status === 'rejected' && <XCircle className="w-3.5 h-3.5" />}
                                  {pay.status === 'pending' && <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />}
                                  {pay.status.charAt(0).toUpperCase() + pay.status.slice(1)}
                                </span>
                              </div>

                              {pay.status === 'pending' ? (
                                <div className="space-y-3 pt-3 border-t border-gray-100">
                                  <input 
                                    type="text" 
                                    placeholder="Add optional note..." 
                                    className="w-full text-sm p-2 border border-gray-200 rounded-md focus:ring-1 focus:ring-brand focus:border-brand"
                                    value={reviewNotes[pay._id] || ''}
                                    onChange={(e) => setReviewNotes({...reviewNotes, [pay._id]: e.target.value})}
                                  />
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => reviewPayment(driver.driverId, pay._id, 'approved')}
                                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-md font-bold text-sm transition-colors"
                                    >Approve</button>
                                    <button 
                                      onClick={() => reviewPayment(driver.driverId, pay._id, 'rejected')}
                                      className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-md font-bold text-sm transition-colors"
                                    >Reject</button>
                                  </div>
                                </div>
                              ) : (
                                pay.note && (
                                  <div className="pt-3 border-t border-gray-100">
                                    <div className="text-xs text-gray-500 mb-1">Admin Note</div>
                                    <p className="text-sm text-gray-800 italic bg-gray-50 p-2 rounded border border-gray-100">{pay.note}</p>
                                  </div>
                                )
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
