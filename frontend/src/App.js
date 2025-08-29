import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

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
          <h4>Quick Login (Demo):</h4>
          <div className="quick-buttons">
            <button onClick={() => quickLogin('admin@university.edu', 'admin123')}>
              Admin
            </button>
            <button onClick={() => quickLogin('manager@university.edu', 'manager123')}>
              Manager
            </button>
            <button onClick={() => quickLogin('cashier@university.edu', 'cashier123')}>
              Cashier
            </button>
            <button onClick={() => quickLogin('student1@university.edu', 'student123')}>
              Student
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Admin Dashboard
const AdminDashboard = () => {
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const [statsRes, usersRes, transactionsRes] = await Promise.all([
        axios.get('/api/admin/dashboard'),
        axios.get('/api/admin/users'),
        axios.get('/api/admin/transactions')
      ]);

      setStats(statsRes.data);
      setUsers(usersRes.data);
      setTransactions(transactionsRes.data);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="dashboard">
      <h2>Admin Dashboard</h2>
      
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Students</h3>
          <p className="stat-number">{stats.totalStudents}</p>
        </div>
        <div className="stat-card">
          <h3>Total Cards</h3>
          <p className="stat-number">{stats.totalCards}</p>
        </div>
        <div className="stat-card">
          <h3>Total Balance</h3>
          <p className="stat-number">₹{stats.totalBalance}</p>
        </div>
        <div className="stat-card">
          <h3>Today's Transactions</h3>
          <p className="stat-number">{stats.todayTransactions}</p>
        </div>
        <div className="stat-card">
          <h3>Pending Recharges</h3>
          <p className="stat-number">{stats.pendingRecharges}</p>
        </div>
      </div>

      <div className="section">
        <h3>Recent Transactions</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Description</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 10).map(transaction => (
                <tr key={transaction._id}>
                  <td>{new Date(transaction.createdAt).toLocaleDateString()}</td>
                  <td className={`type ${transaction.type}`}>{transaction.type}</td>
                  <td>₹{Math.abs(transaction.amount)}</td>
                  <td>{transaction.description}</td>
                  <td className={`status ${transaction.status}`}>{transaction.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <h3>All Users</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Student ID</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user._id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td className={`role ${user.role}`}>{user.role}</td>
                  <td>{user.studentId || '-'}</td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Manager Dashboard
const ManagerDashboard = () => {
  const [rechargeRequests, setRechargeRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRechargeRequests();
  }, []);

  const fetchRechargeRequests = async () => {
    try {
      const response = await axios.get('/api/manager/recharge-requests');
      setRechargeRequests(response.data);
    } catch (error) {
      console.error('Error fetching recharge requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId) => {
    try {
      await axios.post(`/api/manager/recharge-requests/${requestId}/approve`);
      alert('Recharge request approved successfully!');
      fetchRechargeRequests();
    } catch (error) {
      alert('Error approving request: ' + (error.response?.data?.message || 'Unknown error'));
    }
  };

  const handleReject = async (requestId) => {
    try {
      await axios.post(`/api/manager/recharge-requests/${requestId}/reject`);
      alert('Recharge request rejected successfully!');
      fetchRechargeRequests();
    } catch (error) {
      alert('Error rejecting request: ' + (error.response?.data?.message || 'Unknown error'));
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="dashboard">
      <h2>Manager Dashboard</h2>
      
      <div className="section">
        <h3>Pending Recharge Requests ({rechargeRequests.length})</h3>
        {rechargeRequests.length === 0 ? (
          <p className="no-data">No pending recharge requests</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Card Number</th>
                  <th>Amount</th>
                  <th>Requested Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rechargeRequests.map(request => (
                  <tr key={request._id}>
                    <td>
                      <div>
                        <strong>{request.studentId.name}</strong><br/>
                        <small>{request.studentId.email}</small><br/>
                        <small>ID: {request.studentId.studentId}</small>
                      </div>
                    </td>
                    <td>{request.cardId.cardNumber}</td>
                    <td>₹{request.amount}</td>
                    <td>{new Date(request.requestedAt).toLocaleString()}</td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="approve-btn"
                          onClick={() => handleApprove(request._id)}
                        >
                          Approve
                        </button>
                        <button 
                          className="reject-btn"
                          onClick={() => handleReject(request._id)}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// Cashier Dashboard
const CashierDashboard = () => {
  const [cardNumber, setCardNumber] = useState('');
  const [cardInfo, setCardInfo] = useState(null);
  const [meals, setMeals] = useState([]);
  const [selectedMeal, setSelectedMeal] = useState('');
  const [loading, setLoading] = useState(false);

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
    if (!cardNumber.trim()) return;
    
    setLoading(true);
    try {
      const response = await axios.get(`/api/cashier/card/${cardNumber}`);
      setCardInfo(response.data);
    } catch (error) {
      alert('Card not found: ' + (error.response?.data?.message || 'Unknown error'));
      setCardInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const processPurchase = async () => {
    if (!cardInfo || !selectedMeal) {
      alert('Please search for a card and select a meal');
      return;
    }

    try {
      const response = await axios.post('/api/cashier/purchase', {
        cardNumber: cardInfo.cardNumber,
        mealId: selectedMeal
      });
      
      alert(`Purchase successful! Remaining balance: ₹${response.data.remainingBalance}`);
      
      // Refresh card info
      searchCard();
      setSelectedMeal('');
    } catch (error) {
      alert('Purchase failed: ' + (error.response?.data?.message || 'Unknown error'));
    }
  };

  return (
    <div className="dashboard">
      <h2>Cashier Dashboard</h2>
      
      <div className="section">
        <h3>Card Search</h3>
        <div className="search-container">
          <input
            type="text"
            placeholder="Enter card number"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchCard()}
          />
          <button onClick={searchCard} disabled={loading}>
            {loading ? 'Searching...' : 'Search Card'}
          </button>
        </div>

        {cardInfo && (
          <div className="card-info">
            <h4>Card Information</h4>
            <p><strong>Card Number:</strong> {cardInfo.cardNumber}</p>
            <p><strong>Student:</strong> {cardInfo.studentId.name}</p>
            <p><strong>Student ID:</strong> {cardInfo.studentId.studentId}</p>
            <p><strong>Balance:</strong> ₹{cardInfo.balance}</p>
            <p><strong>Status:</strong> {cardInfo.isActive ? 'Active' : 'Inactive'}</p>
          </div>
        )}
      </div>

      <div className="section">
        <h3>Process Purchase</h3>
        <div className="purchase-container">
          <div className="form-group">
            <label>Select Meal:</label>
            <select 
              value={selectedMeal} 
              onChange={(e) => setSelectedMeal(e.target.value)}
              disabled={!cardInfo}
            >
              <option value="">Select a meal</option>
              {meals.map(meal => (
                <option key={meal._id} value={meal._id}>
                  {meal.name} - ₹{meal.price} ({meal.category})
                </option>
              ))}
            </select>
          </div>
          
          <button 
            className="purchase-btn"
            onClick={processPurchase}
            disabled={!cardInfo || !selectedMeal}
          >
            Process Purchase
          </button>
        </div>
      </div>

      <div className="section">
        <h3>Available Meals</h3>
        <div className="meals-grid">
          {meals.map(meal => (
            <div key={meal._id} className="meal-card">
              <h4>{meal.name}</h4>
              <p className="price">₹{meal.price}</p>
              <p className="category">{meal.category}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Student Dashboard
const StudentDashboard = () => {
  const [cardInfo, setCardInfo] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudentData();
  }, []);

  const fetchStudentData = async () => {
    try {
      const [cardRes, transactionsRes] = await Promise.all([
        axios.get('/api/student/card'),
        axios.get('/api/student/transactions')
      ]);

      setCardInfo(cardRes.data);
      setTransactions(transactionsRes.data);
    } catch (error) {
      console.error('Error fetching student data:', error);
    } finally {
      setLoading(false);
    }
  };

  const requestRecharge = async () => {
    const amount = parseFloat(rechargeAmount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      await axios.post('/api/student/recharge-request', { amount });
      alert('Recharge request submitted successfully! Please wait for manager approval.');
      setRechargeAmount('');
    } catch (error) {
      alert('Error submitting recharge request: ' + (error.response?.data?.message || 'Unknown error'));
    }
  };

  const mockRecharge = async () => {
    const amount = parseFloat(rechargeAmount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    // Simulate instant recharge (mock payment gateway)
    try {
      await axios.post('/api/student/recharge-request', { amount });
      alert('Mock payment successful! Recharge request submitted.');
      setRechargeAmount('');
      fetchStudentData(); // Refresh data
    } catch (error) {
      alert('Error processing mock payment: ' + (error.response?.data?.message || 'Unknown error'));
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="dashboard">
      <h2>Student Dashboard</h2>
      
      {cardInfo && (
        <div className="section">
          <h3>My Meal Card</h3>
          <div className="card-display">
            <div className="card-visual">
              <h4>University Meal Card</h4>
              <p><strong>Card Number:</strong> {cardInfo.cardNumber}</p>
              <p><strong>Current Balance:</strong> ₹{cardInfo.balance}</p>
              <p><strong>Status:</strong> {cardInfo.isActive ? 'Active' : 'Inactive'}</p>
            </div>
          </div>
        </div>
      )}

      <div className="section">
        <h3>Recharge Card</h3>
        <div className="recharge-container">
          <div className="form-group">
            <input
              type="number"
              placeholder="Enter amount"
              value={rechargeAmount}
              onChange={(e) => setRechargeAmount(e.target.value)}
              min="1"
            />
          </div>
          <div className="recharge-buttons">
            <button onClick={mockRecharge} className="mock-payment-btn">
              Mock Payment (Instant)
            </button>
            <button onClick={requestRecharge} className="request-btn">
              Request Recharge (Manager Approval)
            </button>
          </div>
          <p className="note">
            <strong>Note:</strong> Mock payment simulates instant payment gateway. 
            Regular requests require manager approval.
          </p>
        </div>
      </div>

      <div className="section">
        <h3>Transaction History</h3>
        {transactions.length === 0 ? (
          <p className="no-data">No transactions found</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Description</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(transaction => (
                  <tr key={transaction._id}>
                    <td>{new Date(transaction.createdAt).toLocaleString()}</td>
                    <td className={`type ${transaction.type}`}>{transaction.type}</td>
                    <td className={transaction.amount < 0 ? 'debit' : 'credit'}>
                      {transaction.amount < 0 ? '-' : '+'}₹{Math.abs(transaction.amount)}
                    </td>
                    <td>{transaction.description}</td>
                    <td className={`status ${transaction.status}`}>{transaction.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// Main App Component
const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
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

  const renderDashboard = () => {
    switch(user.role) {
      case 'admin':
        return <AdminDashboard />;
      case 'manager':
        return <ManagerDashboard />;
      case 'cashier':
        return <CashierDashboard />;
      case 'student':
        return <StudentDashboard />;
      default:
        return <div>Invalid role</div>;
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="App">
      {!user ? (
        <Login onLogin={handleLogin} />
      ) : (
        <div className="app-container">
          <header className="app-header">
            <h1>Campus Meal Card System</h1>
            <div className="user-info">
              <span>Welcome, {user.name} ({user.role})</span>
              <button onClick={handleLogout} className="logout-btn">Logout</button>
            </div>
          </header>
          <main className="main-content">
            {renderDashboard()}
          </main>
        </div>
      )}
    </div>
  );
};

export default App;