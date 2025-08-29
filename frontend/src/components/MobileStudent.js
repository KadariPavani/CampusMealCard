import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './MobileStudent.css';

const MobileStudent = () => {
  const [user, setUser] = useState(null);
  const [cardInfo, setCardInfo] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('dashboard');
  const [showRechargeModal, setShowRechargeModal] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (token && savedUser) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(JSON.parse(savedUser));
      fetchStudentData();
    } else {
      setLoading(false);
    }
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

  const handleLogin = async (email, password) => {
    setLoading(true);
    try {
      const response = await axios.post('/api/auth/login', { email, password });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      setUser(response.data.user);
      
      if (response.data.user.role === 'student') {
        fetchStudentData();
      } else {
        alert('This interface is only for students');
        handleLogout();
      }
    } catch (error) {
      alert('Login failed: ' + (error.response?.data?.message || 'Unknown error'));
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setCardInfo(null);
    setTransactions([]);
    setCurrentView('dashboard');
  };

  const requestRecharge = async (type = 'request') => {
    const amount = parseFloat(rechargeAmount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      await axios.post('/api/student/recharge-request', { amount });
      
      if (type === 'mock') {
        alert('🎉 Mock payment successful! Your recharge request has been submitted and will be processed shortly.');
      } else {
        alert('✅ Recharge request submitted successfully! Please wait for manager approval.');
      }
      
      setRechargeAmount('');
      setShowRechargeModal(false);
      fetchStudentData(); // Refresh data
    } catch (error) {
      alert('❌ Error submitting recharge request: ' + (error.response?.data?.message || 'Unknown error'));
    }
  };

  const quickAmountSelect = (amount) => {
    setRechargeAmount(amount.toString());
  };

  if (loading) {
    return (
      <div className="mobile-app loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <MobileLogin onLogin={handleLogin} />;
  }

  return (
    <div className="mobile-app">
      {/* Header */}
      <header className="mobile-header">
        <h1>Meal Card</h1>
        <div className="header-actions">
          <span className="user-name">Hi, {user.name.split(' ')[0]}</span>
          <button className="logout-btn" onClick={handleLogout}>
            🚪
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mobile-content">
        {currentView === 'dashboard' && (
          <DashboardView 
            cardInfo={cardInfo}
            onShowRecharge={() => setShowRechargeModal(true)}
            onViewTransactions={() => setCurrentView('transactions')}
          />
        )}

        {currentView === 'transactions' && (
          <TransactionsView 
            transactions={transactions}
            onBack={() => setCurrentView('dashboard')}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <button 
          className={currentView === 'dashboard' ? 'active' : ''}
          onClick={() => setCurrentView('dashboard')}
        >
          <span className="nav-icon">🏠</span>
          <span className="nav-label">Home</span>
        </button>
        <button 
          className={currentView === 'transactions' ? 'active' : ''}
          onClick={() => setCurrentView('transactions')}
        >
          <span className="nav-icon">📄</span>
          <span className="nav-label">History</span>
        </button>
      </nav>

      {/* Recharge Modal */}
      {showRechargeModal && (
        <RechargeModal
          amount={rechargeAmount}
          onAmountChange={setRechargeAmount}
          onQuickSelect={quickAmountSelect}
          onRequestRecharge={() => requestRecharge('request')}
          onMockPayment={() => requestRecharge('mock')}
          onClose={() => {
            setShowRechargeModal(false);
            setRechargeAmount('');
          }}
        />
      )}
    </div>
  );
};

// Mobile Login Component
const MobileLogin = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onLogin(email, password);
    setLoading(false);
  };

  const quickLogin = () => {
    setEmail('student1@university.edu');
    setPassword('student123');
  };

  return (
    <div className="mobile-login">
      <div className="login-header">
        <div className="app-icon">🍽️</div>
        <h2>Campus Meal Card</h2>
        <p>Student Mobile Access</p>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        <div className="input-group">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="input-group">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        
        <button type="submit" className="login-btn" disabled={loading}>
          {loading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>

      <div className="demo-section">
        <p>Demo Student Account:</p>
        <button className="demo-btn" onClick={quickLogin}>
          Use Demo Account
        </button>
      </div>
    </div>
  );
};

// Dashboard View Component
const DashboardView = ({ cardInfo, onShowRecharge, onViewTransactions }) => {
  const getBalanceColor = (balance) => {
    if (balance < 100) return '#e74c3c';
    if (balance < 300) return '#f39c12';
    return '#27ae60';
  };

  const getBalanceMessage = (balance) => {
    if (balance < 50) return 'Low Balance! Please recharge soon.';
    if (balance < 100) return 'Consider recharging your card.';
    return 'You have sufficient balance.';
  };

  return (
    <div className="dashboard-view">
      {/* Balance Card */}
      <div className="balance-card">
        <div className="card-visual">
          <div className="card-header">
            <h3>Meal Card Balance</h3>
            <div className="card-number">
              {cardInfo?.cardNumber?.slice(-4) ? `****${cardInfo.cardNumber.slice(-4)}` : 'Loading...'}
            </div>
          </div>
          <div className="balance-amount" style={{ color: getBalanceColor(cardInfo?.balance || 0) }}>
            ₹{cardInfo?.balance || 0}
          </div>
          <div className="balance-status">
            <span className={cardInfo?.isActive ? 'active' : 'inactive'}>
              {cardInfo?.isActive ? '✅ Active' : '❌ Inactive'}
            </span>
          </div>
        </div>
        <div className="balance-message">
          <p>{getBalanceMessage(cardInfo?.balance || 0)}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="action-grid">
          <button className="action-btn recharge" onClick={onShowRecharge}>
            <span className="action-icon">💳</span>
            <span className="action-label">Recharge Card</span>
          </button>
          <button className="action-btn transactions" onClick={onViewTransactions}>
            <span className="action-icon">📊</span>
            <span className="action-label">View History</span>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="recent-activity">
        <h3>Recent Activity</h3>
        <div className="activity-placeholder">
          <p>Your recent transactions will appear here</p>
          <button className="view-all-btn" onClick={onViewTransactions}>
            View All Transactions
          </button>
        </div>
      </div>
    </div>
  );
};

// Transactions View Component
const TransactionsView = ({ transactions, onBack }) => {
  const formatAmount = (amount) => {
    const absAmount = Math.abs(amount);
    const sign = amount >= 0 ? '+' : '-';
    return `${sign}₹${absAmount}`;
  };

  const getTransactionIcon = (type) => {
    return type === 'recharge' ? '💰' : '🍽️';
  };

  const getTransactionColor = (amount) => {
    return amount >= 0 ? '#27ae60' : '#e74c3c';
  };

  return (
    <div className="transactions-view">
      <div className="view-header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <h2>Transaction History</h2>
      </div>

      <div className="transactions-list">
        {transactions.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📝</span>
            <p>No transactions yet</p>
            <small>Your transaction history will appear here</small>
          </div>
        ) : (
          transactions.map(transaction => (
            <div key={transaction._id} className="transaction-item">
              <div className="transaction-icon">
                {getTransactionIcon(transaction.type)}
              </div>
              <div className="transaction-details">
                <div className="transaction-description">
                  {transaction.description}
                </div>
                <div className="transaction-date">
                  {new Date(transaction.createdAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
                <div className={`transaction-status ${transaction.status}`}>
                  {transaction.status}
                </div>
              </div>
              <div 
                className="transaction-amount"
                style={{ color: getTransactionColor(transaction.amount) }}
              >
                {formatAmount(transaction.amount)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Recharge Modal Component
const RechargeModal = ({ 
  amount, 
  onAmountChange, 
  onQuickSelect, 
  onRequestRecharge, 
  onMockPayment, 
  onClose 
}) => {
  const quickAmounts = [100, 200, 500, 1000];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="recharge-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Recharge Your Card</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="amount-input-section">
            <label>Enter Amount</label>
            <input
              type="number"
              placeholder="₹ 0"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              min="1"
              className="amount-input"
            />
          </div>

          <div className="quick-amounts">
            <label>Quick Select</label>
            <div className="amount-buttons">
              {quickAmounts.map(amt => (
                <button
                  key={amt}
                  className={`amount-btn ${amount === amt ? 'selected' : ''}`}
                  onClick={() => onQuickSelect(amt)}
                >
                  ₹{amt}
                </button>
              ))}
            </div>
          </div>

          <div className="recharge-options">
            <button 
              className="recharge-btn mock-payment"
              onClick={onMockPayment}
              disabled={!amount || parseFloat(amount) <= 0}
            >
              <span className="btn-icon">⚡</span>
              <div className="btn-content">
                <div className="btn-title">Instant Payment</div>
                <div className="btn-subtitle">Mock payment gateway</div>
              </div>
            </button>

            <button 
              className="recharge-btn manager-approval"
              onClick={onRequestRecharge}
              disabled={!amount || parseFloat(amount) <= 0}
            >
              <span className="btn-icon">⏳</span>
              <div className="btn-content">
                <div className="btn-title">Request Approval</div>
                <div className="btn-subtitle">Requires manager approval</div>
              </div>
            </button>
          </div>

          <div className="recharge-info">
            <p><strong>Note:</strong> Mock payment simulates an instant payment gateway for demo purposes. Regular requests require manager approval and may take some time to process.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileStudent;