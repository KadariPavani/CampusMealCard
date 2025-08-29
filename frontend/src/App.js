import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import { QRCodeCanvas } from 'qrcode.react';
import QRCode from 'qrcode.react';
// Set axios defaults
axios.defaults.baseURL = 'http://localhost:5000';

// Auth Context
const AuthContext = React.createContext();

// Login Component
const Login = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/auth/login', formData);
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      onLogin(response.data.user);
    } catch (error) {
      setError(error.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (email, password) => {
    setFormData({ email, password });
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>Campus Meal Card System</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required
            />
          </div>
          <div className="form-group">
            <input
              type="password"
              placeholder="Password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              required
            />
          </div>
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="quick-login">
          <h4>Quick Login:</h4>
          <button onClick={() => quickLogin('admin@university.edu', 'admin123')}>
            Admin Login
          </button>
          <button onClick={() => quickLogin('manager1@university.edu', 'manager123')}>
            Manager Login
          </button>
          <button onClick={() => quickLogin('cashier1@university.edu', 'cashier123')}>
            Cashier Login
          </button>
          <button onClick={() => quickLogin('student1@university.edu', 'student123')}>
            Student Login
          </button>
        </div>
      </div>
    </div>
  );
};

// Student Dashboard
const StudentDashboard = () => {
  const [card, setCard] = useState(null);
  const [meals, setMeals] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [rechargeRequests, setRechargeRequests] = useState([]);
  const [showRecharge, setShowRecharge] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [upiReference, setUpiReference] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [upiUrl, setUpiUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [cardRes, mealsRes, transactionsRes, requestsRes] = await Promise.all([
        axios.get('/api/student/card'),
        axios.get('/api/student/meals'),
        axios.get('/api/student/transactions'),
        axios.get('/api/student/recharge-requests')
      ]);
      setCard(cardRes.data);
      setMeals(mealsRes.data);
      setTransactions(transactionsRes.data);
      setRechargeRequests(requestsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleRecharge = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    formData.append('amount', rechargeAmount);
    formData.append('transactionId', transactionId);
    formData.append('upiReference', upiReference);
    formData.append('paymentMethod', 'upi');
    if (screenshot) {
      formData.append('screenshot', screenshot);
    }

    try {
      await axios.post('/api/student/recharge-request', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('Recharge request submitted successfully!');
      setShowRecharge(false);
      setRechargeAmount('');
      setTransactionId('');
      setUpiReference('');
      setScreenshot(null);
      fetchData();
    } catch (error) {
      alert(error.response?.data?.message || 'Recharge request failed');
    } finally {
      setLoading(false);
    }
  };

  const generateUpiUrl = async () => {
    if (!rechargeAmount || rechargeAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      const response = await axios.get(`/api/payment/upi-url?amount=${rechargeAmount}`);
      setUpiUrl(response.data.upiUrl);
    } catch (error) {
      alert('Error generating UPI URL');
    }
  };

  return (
    <div className="dashboard">
      <h2>Student Dashboard</h2>
      
      {card && (
        <div className="card-info">
          <h3>Meal Card Information</h3>
          <p>Card Number: {card.cardNumber}</p>
          <p>Balance: ₹{card.balance}</p>
          <p>Status: {card.isActive ? 'Active' : 'Inactive'}</p>
          <button onClick={() => setShowRecharge(true)}>Request Recharge</button>
        </div>
      )}

      {showRecharge && (
        <div className="modal">
          <div className="modal-content">
            <h3>Request Recharge</h3>
            <form onSubmit={handleRecharge}>
              <div className="form-group">
                <label>Amount:</label>
                <input
                  type="number"
                  value={rechargeAmount}
                  onChange={(e) => setRechargeAmount(e.target.value)}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>UPI Payment:</label>
                <button type="button" onClick={generateUpiUrl}>
                  Generate UPI Payment Link
                </button>
{upiUrl && (
  <div className="upi-info">
    <p>Scan the QR code or use the UPI ID:</p>
    <QRCodeCanvas value={upiUrl} size={180} />
    <p>UPI ID: {process.env.PHONEPAY_UPI_ID || '96660741389@ibl'}</p>
    <a href={upiUrl} target="_blank" rel="noopener noreferrer">
      Pay with UPI
    </a>
  </div>
)}
              </div>

              <div className="form-group">
                <label>Transaction ID:</label>
                <input
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>UPI Reference:</label>
                <input
                  type="text"
                  value={upiReference}
                  onChange={(e) => setUpiReference(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Screenshot:</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setScreenshot(e.target.files[0])}
                />
              </div>

              <button type="submit" disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
              <button type="button" onClick={() => setShowRecharge(false)}>
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="recharge-requests">
        <h3>Recharge Requests</h3>
        <table>
          <thead>
            <tr>
              <th>Amount</th>
              <th>Status</th>
              <th>Requested At</th>
            </tr>
          </thead>
          <tbody>
            {rechargeRequests.map(request => (
              <tr key={request._id}>
                <td>₹{request.amount}</td>
                <td>{request.status}</td>
                <td>{new Date(request.requestedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="meals-section">
        <h3>Available Meals</h3>
        <div className="meals-grid">
          {meals.map(meal => (
            <div key={meal._id} className="meal-card">
              <h4>{meal.name}</h4>
              <p>₹{meal.price}</p>
              <p>{meal.category}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="transactions">
        <h3>Recent Transactions</h3>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Amount</th>
              <th>Description</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(transaction => (
              <tr key={transaction._id}>
                <td>{transaction.type}</td>
                <td>₹{Math.abs(transaction.amount)}</td>
                <td>{transaction.description}</td>
                <td>{new Date(transaction.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Manager Dashboard
const ManagerDashboard = () => {
  const [rechargeRequests, setRechargeRequests] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchData();
  }, [filter]);

  const fetchData = async () => {
    try {
      const [requestsRes, analyticsRes] = await Promise.all([
        axios.get(`/api/manager/recharge-requests?status=${filter === 'all' ? '' : filter}`),
        axios.get('/api/manager/analytics')
      ]);
      setRechargeRequests(requestsRes.data);
      setAnalytics(analyticsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleApprove = async (requestId) => {
    try {
      await axios.post(`/api/manager/recharge-requests/${requestId}/approve`);
      alert('Request approved successfully');
      fetchData();
    } catch (error) {
      alert(error.response?.data?.message || 'Approval failed');
    }
  };

  const handleReject = async (requestId) => {
    try {
      await axios.post(`/api/manager/recharge-requests/${requestId}/reject`);
      alert('Request rejected successfully');
      fetchData();
    } catch (error) {
      alert(error.response?.data?.message || 'Rejection failed');
    }
  };

  return (
    <div className="dashboard">
      <h2>Manager Dashboard</h2>

      {analytics && (
        <div className="analytics">
          <h3>Today's Analytics</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <h4>Total Recharges</h4>
              <p>{analytics.totalRecharges}</p>
            </div>
            <div className="stat-card">
              <h4>Total Purchases</h4>
              <p>{analytics.totalPurchases}</p>
            </div>
            <div className="stat-card">
              <h4>Total Revenue</h4>
              <p>₹{analytics.totalRevenue}</p>
            </div>
            <div className="stat-card">
              <h4>Pending Requests</h4>
              <p>{analytics.pendingRequests}</p>
            </div>
            <div className="stat-card">
              <h4>Approved Requests</h4>
              <p>{analytics.approvedRequests}</p>
            </div>
            <div className="stat-card">
              <h4>Rejected Requests</h4>
              <p>{analytics.rejectedRequests}</p>
            </div>
          </div>
        </div>
      )}

      <div className="requests-section">
        <h3>Recharge Requests</h3>
        <div className="filter-buttons">
          <button onClick={() => setFilter('all')} className={filter === 'all' ? 'active' : ''}>
            All
          </button>
          <button onClick={() => setFilter('pending')} className={filter === 'pending' ? 'active' : ''}>
            Pending
          </button>
          <button onClick={() => setFilter('approved')} className={filter === 'approved' ? 'active' : ''}>
            Approved
          </button>
          <button onClick={() => setFilter('rejected')} className={filter === 'rejected' ? 'active' : ''}>
            Rejected
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Card Number</th>
              <th>Amount</th>
              <th>Payment Method</th>
              <th>Transaction ID</th>
              <th>Screenshot</th>
              <th>Status</th>
              <th>Requested At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rechargeRequests.map(request => (
              <tr key={request._id}>
                <td>{request.studentId?.name}</td>
                <td>{request.cardId?.cardNumber}</td>
                <td>₹{request.amount}</td>
                <td>{request.paymentMethod}</td>
                <td>{request.transactionId || '-'}</td>
                <td>
                  {request.screenshot ? (
                    <a href={`http://localhost:5000/${request.screenshot}`} target="_blank" rel="noopener noreferrer">
                      <img
                        src={`http://localhost:5000/${request.screenshot}`}
                        alt="Screenshot"
                        style={{ width: '80px', height: 'auto', cursor: 'pointer' }}
                      />
                    </a>
                  ) : (
                    'No Screenshot'
                  )}
                </td>
                <td>{request.status}</td>
                <td>{new Date(request.requestedAt).toLocaleString()}</td>
                <td>
                  {request.status === 'pending' && (
                    <>
                      <button onClick={() => handleApprove(request._id)}>Approve</button>
                      <button onClick={() => handleReject(request._id)}>Reject</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};


// Cashier Dashboard
const CashierDashboard = () => {
  const [meals, setMeals] = useState([]);
  const [cardNumber, setCardNumber] = useState('');
  const [selectedMeal, setSelectedMeal] = useState('');
  const [cardInfo, setCardInfo] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchMeals();
  }, []);

  const fetchMeals = async () => {
    try {
      const response = await axios.get('/api/cashier/meals');
      setMeals(response.data);
    } catch (error) {
      console.error('Error fetching meals:', error);
    }
  };

  const searchCard = async () => {
    try {
      const response = await axios.get(`/api/cashier/card/${cardNumber}`);
      setCardInfo(response.data);
      setMessage('');
    } catch (error) {
      setCardInfo(null);
      setMessage('Card not found');
    }
  };

  const handlePurchase = async () => {
    if (!selectedMeal || !cardInfo) {
      setMessage('Please select a meal and verify card');
      return;
    }

    try {
      const response = await axios.post('/api/cashier/purchase', {
        cardNumber: cardInfo.cardNumber,
        mealId: selectedMeal
      });
      setMessage(`Purchase successful! Remaining balance: ₹${response.data.remainingBalance}`);
      setCardInfo({ ...cardInfo, balance: response.data.remainingBalance });
      setSelectedMeal('');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Purchase failed');
    }
  };

  return (
    <div className="dashboard">
      <h2>Cashier Dashboard</h2>

      <div className="card-search">
        <h3>Search Card</h3>
        <div className="search-form">
          <input
            type="text"
            placeholder="Enter card number"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
          />
          <button onClick={searchCard}>Search</button>
        </div>
      </div>

      {cardInfo && (
        <div className="card-info">
          <h3>Card Information</h3>
          <p>Card Number: {cardInfo.cardNumber}</p>
          <p>Student: {cardInfo.studentId?.name}</p>
          <p>Student ID: {cardInfo.studentId?.studentId}</p>
          <p>Balance: ₹{cardInfo.balance}</p>
        </div>
      )}

      <div className="purchase-section">
        <h3>Make Purchase</h3>
        <select
          value={selectedMeal}
          onChange={(e) => setSelectedMeal(e.target.value)}
        >
          <option value="">Select a meal</option>
          {meals.map(meal => (
            <option key={meal._id} value={meal._id}>
              {meal.name} - ₹{meal.price}
            </option>
          ))}
        </select>
        <button onClick={handlePurchase} disabled={!selectedMeal || !cardInfo}>
          Process Purchase
        </button>
      </div>

      {message && <div className="message">{message}</div>}

      <div className="meals-list">
        <h3>Available Meals</h3>
        <div className="meals-grid">
          {meals.map(meal => (
            <div key={meal._id} className="meal-card">
              <h4>{meal.name}</h4>
              <p>₹{meal.price}</p>
              <p>{meal.category}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Admin Dashboard
const AdminDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [users, setUsers] = useState([]);
  const [meals, setMeals] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
    studentId: ''
  });
  const [newMeal, setNewMeal] = useState({
    name: '',
    price: '',
    category: '',
    description: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [dashboardRes, usersRes, mealsRes, transactionsRes] = await Promise.all([
        axios.get('/api/admin/dashboard'),
        axios.get('/api/admin/users'),
        axios.get('/api/admin/meals'),
        axios.get('/api/admin/transactions')
      ]);
      setDashboardData(dashboardRes.data);
      setUsers(usersRes.data);
      setMeals(mealsRes.data);
      setTransactions(transactionsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/admin/users', newUser);
      alert('User added successfully');
      setShowAddUser(false);
      setNewUser({
        name: '',
        email: '',
        password: '',
        role: 'student',
        studentId: ''
      });
      fetchData();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to add user');
    }
  };

  const handleAddMeal = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/admin/meals', newMeal);
      alert('Meal added successfully');
      setShowAddMeal(false);
      setNewMeal({
        name: '',
        price: '',
        category: '',
        description: ''
      });
      fetchData();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to add meal');
    }
  };

  const handleDeleteMeal = async (mealId) => {
    if (window.confirm('Are you sure you want to delete this meal?')) {
      try {
        await axios.delete(`/api/admin/meals/${mealId}`);
        alert('Meal deleted successfully');
        fetchData();
      } catch (error) {
        alert(error.response?.data?.message || 'Failed to delete meal');
      }
    }
  };

  return (
    <div className="dashboard">
      <h2>Admin Dashboard</h2>

      {dashboardData && (
        <div className="admin-stats">
          <h3>System Overview</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <h4>Total Students</h4>
              <p>{dashboardData.totalStudents}</p>
            </div>
            <div className="stat-card">
              <h4>Total Managers</h4>
              <p>{dashboardData.totalManagers}</p>
            </div>
            <div className="stat-card">
              <h4>Total Cashiers</h4>
              <p>{dashboardData.totalCashiers}</p>
            </div>
            <div className="stat-card">
              <h4>Total Cards</h4>
              <p>{dashboardData.totalCards}</p>
            </div>
            <div className="stat-card">
              <h4>Total Balance</h4>
              <p>₹{dashboardData.totalBalance}</p>
            </div>
            <div className="stat-card">
              <h4>Today's Transactions</h4>
              <p>{dashboardData.todayTransactions}</p>
            </div>
            <div className="stat-card">
              <h4>Pending Recharges</h4>
              <p>{dashboardData.pendingRecharges}</p>
            </div>
          </div>
        </div>
      )}

      <div className="admin-sections">
        <div className="admin-section">
          <h3>User Management</h3>
          <button onClick={() => setShowAddUser(true)}>Add New User</button>
          
          {showAddUser && (
            <div className="modal">
              <div className="modal-content">
                <h4>Add New User</h4>
                <form onSubmit={handleAddUser}>
                  <input
                    type="text"
                    placeholder="Name"
                    value={newUser.name}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                    required
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    required
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    required
                  />
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                  >
                    <option value="student">Student</option>
                    <option value="manager">Manager</option>
                    <option value="cashier">Cashier</option>
                  </select>
                  {newUser.role === 'student' && (
                    <input
                      type="text"
                      placeholder="Student ID"
                      value={newUser.studentId}
                      onChange={(e) => setNewUser({...newUser, studentId: e.target.value})}
                    />
                  )}
                  <button type="submit">Add User</button>
                  <button type="button" onClick={() => setShowAddUser(false)}>
                    Cancel
                  </button>
                </form>
              </div>
            </div>
          )}

          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Student ID</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user._id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{user.studentId || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="admin-section">
          <h3>Meal Management</h3>
          <button onClick={() => setShowAddMeal(true)}>Add New Meal</button>
          
          {showAddMeal && (
            <div className="modal">
              <div className="modal-content">
                <h4>Add New Meal</h4>
                <form onSubmit={handleAddMeal}>
                  <input
                    type="text"
                    placeholder="Meal Name"
                    value={newMeal.name}
                    onChange={(e) => setNewMeal({...newMeal, name: e.target.value})}
                    required
                  />
                  <input
                    type="number"
                    placeholder="Price"
                    value={newMeal.price}
                    onChange={(e) => setNewMeal({...newMeal, price: e.target.value})}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Category"
                    value={newMeal.category}
                    onChange={(e) => setNewMeal({...newMeal, category: e.target.value})}
                    required
                  />
                  <textarea
                    placeholder="Description"
                    value={newMeal.description}
                    onChange={(e) => setNewMeal({...newMeal, description: e.target.value})}
                  />
                  <button type="submit">Add Meal</button>
                  <button type="button" onClick={() => setShowAddMeal(false)}>
                    Cancel
                  </button>
                </form>
              </div>
            </div>
          )}

          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Price</th>
                <th>Category</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {meals.map(meal => (
                <tr key={meal._id}>
                  <td>{meal.name}</td>
                  <td>₹{meal.price}</td>
                  <td>{meal.category}</td>
                  <td>{meal.isAvailable ? 'Available' : 'Unavailable'}</td>
                  <td>
                    <button onClick={() => handleDeleteMeal(meal._id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="admin-section">
          <h3>Recent Transactions</h3>
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Amount</th>
                <th>Description</th>
                <th>Processed By</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(transaction => (
                <tr key={transaction._id}>
                  <td>{transaction.type}</td>
                  <td>₹{Math.abs(transaction.amount)}</td>
                  <td>{transaction.description}</td>
                  <td>{transaction.processedBy?.name || 'System'}</td>
                  <td>{new Date(transaction.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Main App Component
function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const renderDashboard = () => {
    switch (user.role) {
      case 'student':
        return <StudentDashboard />;
      case 'manager':
        return <ManagerDashboard />;
      case 'cashier':
        return <CashierDashboard />;
      case 'admin':
        return <AdminDashboard />;
      default:
        return <div>Unknown role</div>;
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <div className="App">
        <header className="header">
          <h1>Campus Meal Card System</h1>
          <div className="user-info">
            <span>Welcome, {user.name} ({user.role})</span>
            <button onClick={handleLogout}>Logout</button>
          </div>
        </header>
        <main>
          {renderDashboard()}
        </main>
      </div>
    </AuthContext.Provider>
  );
}

export default App;