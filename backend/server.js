const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mealcard', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'manager', 'cashier', 'student'], required: true },
  studentId: { type: String, unique: true, sparse: true }, // Only for students
  createdAt: { type: Date, default: Date.now },
});

// Meal Card Schema
const mealCardSchema = new mongoose.Schema({
  cardNumber: { type: String, required: true, unique: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  balance: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

// Transaction Schema
const transactionSchema = new mongoose.Schema({
  cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'MealCard', required: true },
  type: { type: String, enum: ['recharge', 'purchase'], required: true },
  amount: { type: Number, required: true },
  description: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'completed'], default: 'completed' },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});

// Recharge Request Schema (Updated with payment details)
const rechargeRequestSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'MealCard', required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  paymentMethod: { type: String, enum: ['online', 'cash', 'upi'], default: 'upi' },
  transactionId: { type: String },
  screenshot: { type: String }, // Path to uploaded screenshot
  upiReference: { type: String },
  requestedAt: { type: Date, default: Date.now },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  processedAt: { type: Date },
});

// Meal Schema
const mealSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  isAvailable: { type: Boolean, default: true },
  image: { type: String }, // Path to meal image
  description: { type: String },
  createdAt: { type: Date, default: Date.now },
});

// Analytics Schema for manager dashboard
const analyticsSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  totalRecharges: { type: Number, default: 0 },
  totalPurchases: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  pendingRequests: { type: Number, default: 0 },
  approvedRequests: { type: Number, default: 0 },
  rejectedRequests: { type: Number, default: 0 },
});

// Models
const User = mongoose.model('User', userSchema);
const MealCard = mongoose.model('MealCard', mealCardSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const RechargeRequest = mongoose.model('RechargeRequest', rechargeRequestSchema);
const Meal = mongoose.model('Meal', mealSchema);
const Analytics = mongoose.model('Analytics', analyticsSchema);

// Middleware for authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Authorization middleware
const authorize = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
};

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role, studentId } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const userData = {
      name,
      email,
      password: hashedPassword,
      role,
    };

    if (role === 'student' && studentId) {
      userData.studentId = studentId;
    }

    const user = new User(userData);
    await user.save();

    // Create meal card for students
    if (role === 'student') {
      const cardNumber = `CARD${Date.now()}`;
      const mealCard = new MealCard({
        cardNumber,
        studentId: user._id,
        balance: 100, // Default balance for new students
      });
      await mealCard.save();
    }

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        studentId: user.studentId,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Student Routes
app.get('/api/student/card', authenticateToken, authorize(['student']), async (req, res) => {
  try {
    const card = await MealCard.findOne({ studentId: req.user.userId }).populate('studentId', 'name email studentId');
    if (!card) {
      return res.status(404).json({ message: 'Card not found' });
    }
    res.json(card);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/student/transactions', authenticateToken, authorize(['student']), async (req, res) => {
  try {
    const card = await MealCard.findOne({ studentId: req.user.userId });
    if (!card) {
      return res.status(404).json({ message: 'Card not found' });
    }

    const transactions = await Transaction.find({ cardId: card._id })
      .sort({ createdAt: -1 })
      .populate('processedBy', 'name');
    
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/student/meals', authenticateToken, authorize(['student']), async (req, res) => {
  try {
    const meals = await Meal.find({ isAvailable: true });
    res.json(meals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/student/recharge-request', authenticateToken, authorize(['student']), upload.single('screenshot'), async (req, res) => {
  try {
    const { amount, transactionId, upiReference, paymentMethod } = req.body;
    
    if (amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    const card = await MealCard.findOne({ studentId: req.user.userId });
    if (!card) {
      return res.status(404).json({ message: 'Card not found' });
    }

    const rechargeRequest = new RechargeRequest({
      studentId: req.user.userId,
      cardId: card._id,
      amount,
      transactionId,
      upiReference,
      paymentMethod: paymentMethod || 'upi',
      screenshot: req.file ? req.file.path : null,
    });

    await rechargeRequest.save();
    
    // Update analytics
    await updateAnalytics();
    
    res.status(201).json({ 
      message: 'Recharge request submitted successfully',
      requestId: rechargeRequest._id 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/student/recharge-requests', authenticateToken, authorize(['student']), async (req, res) => {
  try {
    const requests = await RechargeRequest.find({ studentId: req.user.userId })
      .sort({ requestedAt: -1 })
      .populate('processedBy', 'name');
    
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Generate UPI payment URL
app.get('/api/payment/upi-url', authenticateToken, authorize(['student']), async (req, res) => {
  try {
    const { amount } = req.query;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    const upiId = process.env.PHONEPAY_UPI_ID || '96660741389@ibl';
    const receiverName = process.env.PHONEPAY_RECEIVER_NAME || 'University Meal Card System';
    
    const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(receiverName)}&am=${amount}&cu=INR`;
    
    res.json({ upiUrl, upiId, receiverName });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Manager Routes
app.get('/api/manager/recharge-requests', authenticateToken, authorize(['manager', 'admin']), async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    
    const requests = await RechargeRequest.find(filter)
      .populate('studentId', 'name email studentId')
      .populate('cardId', 'cardNumber')
      .populate('processedBy', 'name')
      .sort({ requestedAt: -1 });
    
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/manager/analytics', authenticateToken, authorize(['manager', 'admin']), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const analytics = await Analytics.findOne({ date: today });
    
    if (!analytics) {
      // Create new analytics entry for today
      const newAnalytics = new Analytics({
        date: today,
        totalRecharges: 0,
        totalPurchases: 0,
        totalRevenue: 0,
        pendingRequests: await RechargeRequest.countDocuments({ status: 'pending' }),
        approvedRequests: await RechargeRequest.countDocuments({ status: 'approved' }),
        rejectedRequests: await RechargeRequest.countDocuments({ status: 'rejected' }),
      });
      await newAnalytics.save();
      return res.json(newAnalytics);
    }
    
    // Update current analytics
    analytics.pendingRequests = await RechargeRequest.countDocuments({ status: 'pending' });
    analytics.approvedRequests = await RechargeRequest.countDocuments({ status: 'approved' });
    analytics.rejectedRequests = await RechargeRequest.countDocuments({ status: 'rejected' });
    await analytics.save();
    
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/manager/recharge-requests/:id/approve', authenticateToken, authorize(['manager', 'admin']), async (req, res) => {
  try {
    const request = await RechargeRequest.findById(req.params.id)
      .populate('cardId')
      .populate('studentId');
    
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    request.status = 'approved';
    request.processedBy = req.user.userId;
    request.processedAt = new Date();
    await request.save();

    // Update card balance
    const card = await MealCard.findById(request.cardId._id);
    card.balance += request.amount;
    await card.save();

    // Create transaction record
    const transaction = new Transaction({
      cardId: request.cardId._id,
      type: 'recharge',
      amount: request.amount,
      description: `Recharge approved by manager - ${request.paymentMethod} payment`,
      processedBy: req.user.userId,
    });
    await transaction.save();

    // Update analytics
    await updateAnalytics();

    res.json({ message: 'Recharge request approved successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/manager/recharge-requests/:id/reject', authenticateToken, authorize(['manager', 'admin']), async (req, res) => {
  try {
    const request = await RechargeRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    request.status = 'rejected';
    request.processedBy = req.user.userId;
    request.processedAt = new Date();
    await request.save();

    // Update analytics
    await updateAnalytics();

    res.json({ message: 'Recharge request rejected successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Cashier Routes
app.get('/api/cashier/meals', authenticateToken, authorize(['cashier', 'admin']), async (req, res) => {
  try {
    const meals = await Meal.find({ isAvailable: true });
    res.json(meals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/cashier/purchase', authenticateToken, authorize(['cashier', 'admin']), async (req, res) => {
  try {
    const { cardNumber, mealId } = req.body;
    
    const card = await MealCard.findOne({ cardNumber, isActive: true })
      .populate('studentId', 'name');
    
    if (!card) {
      return res.status(404).json({ message: 'Card not found or inactive' });
    }

    const meal = await Meal.findById(mealId);
    if (!meal || !meal.isAvailable) {
      return res.status(404).json({ message: 'Meal not available' });
    }

    if (card.balance < meal.price) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    // Deduct balance
    card.balance -= meal.price;
    await card.save();

    // Create transaction record
    const transaction = new Transaction({
      cardId: card._id,
      type: 'purchase',
      amount: -meal.price,
      description: `Purchase: ${meal.name}`,
      processedBy: req.user.userId,
    });
    await transaction.save();

    // Update analytics
    await updateAnalytics();

    res.json({ 
      message: 'Purchase successful',
      remainingBalance: card.balance,
      studentName: card.studentId.name
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin Routes
app.get('/api/admin/dashboard', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalManagers = await User.countDocuments({ role: 'manager' });
    const totalCashiers = await User.countDocuments({ role: 'cashier' });
    const totalCards = await MealCard.countDocuments();
    const totalBalance = await MealCard.aggregate([
      { $group: { _id: null, total: { $sum: '$balance' } } }
    ]);
    
    const todayTransactions = await Transaction.countDocuments({
      createdAt: { $gte: new Date().setHours(0, 0, 0, 0) }
    });

    const pendingRecharges = await RechargeRequest.countDocuments({ status: 'pending' });

    res.json({
      totalStudents,
      totalManagers,
      totalCashiers,
      totalCards,
      totalBalance: totalBalance[0]?.total || 0,
      todayTransactions,
      pendingRecharges,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/admin/users', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const { role } = req.query;
    const filter = role ? { role } : {};
    
    const users = await User.find(filter).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/admin/users', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const { name, email, password, role, studentId } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const userData = {
      name,
      email,
      password: hashedPassword,
      role,
    };

    if (role === 'student' && studentId) {
      userData.studentId = studentId;
    }

    const user = new User(userData);
    await user.save();

    // Create meal card for students
    if (role === 'student') {
      const cardNumber = `CARD${Date.now()}`;
      const mealCard = new MealCard({
        cardNumber,
        studentId: user._id,
        balance: 100, // Default balance
      });
      await mealCard.save();
    }

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/admin/transactions', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate('cardId')
      .populate('processedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(100);
    
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Meal management routes
app.get('/api/admin/meals', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const meals = await Meal.find().sort({ createdAt: -1 });
    res.json(meals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/admin/meals', authenticateToken, authorize(['admin']), upload.single('image'), async (req, res) => {
  try {
    const { name, price, category, description } = req.body;
    const meal = new Meal({ 
      name, 
      price, 
      category, 
      description,
      image: req.file ? req.file.path : null
    });
    await meal.save();
    res.status(201).json(meal);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/admin/meals/:id', authenticateToken, authorize(['admin']), upload.single('image'), async (req, res) => {
  try {
    const { name, price, category, description, isAvailable } = req.body;
    const updateData = { name, price, category, description, isAvailable };
    
    if (req.file) {
      updateData.image = req.file.path;
    }

    const meal = await Meal.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    if (!meal) {
      return res.status(404).json({ message: 'Meal not found' });
    }
    
    res.json(meal);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/admin/meals/:id', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const meal = await Meal.findByIdAndDelete(req.params.id);
    if (!meal) {
      return res.status(404).json({ message: 'Meal not found' });
    }
    
    res.json({ message: 'Meal deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Bulk user upload (Excel/CSV would be handled here)
app.post('/api/admin/users/bulk', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const { users } = req.body; // Array of user objects
    
    const results = {
      success: [],
      errors: []
    };

    for (const userData of users) {
      try {
        const existingUser = await User.findOne({ email: userData.email });
        if (existingUser) {
          results.errors.push({ user: userData, error: 'User already exists' });
          continue;
        }

        const hashedPassword = await bcrypt.hash(userData.password || 'default123', 10);
        
        const user = new User({
          name: userData.name,
          email: userData.email,
          password: hashedPassword,
          role: userData.role,
          studentId: userData.studentId
        });

        await user.save();

        // Create meal card for students
        if (userData.role === 'student') {
          const cardNumber = `CARD${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const mealCard = new MealCard({
            cardNumber,
            studentId: user._id,
            balance: 100, // Default balance
          });
          await mealCard.save();
        }

        results.success.push(user);
      } catch (error) {
        results.errors.push({ user: userData, error: error.message });
      }
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all meals (for both cashier and student)
app.get('/api/meals', authenticateToken, async (req, res) => {
  try {
    const meals = await Meal.find({ isAvailable: true });
    res.json(meals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Search card by number (for cashiers)
app.get('/api/cashier/card/:cardNumber', authenticateToken, authorize(['cashier', 'admin']), async (req, res) => {
  try {
    const card = await MealCard.findOne({ cardNumber: req.params.cardNumber })
      .populate('studentId', 'name email studentId');
    
    if (!card) {
      return res.status(404).json({ message: 'Card not found' });
    }

    res.json(card);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Helper function to update analytics
async function updateAnalytics() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let analytics = await Analytics.findOne({ date: today });
    
    if (!analytics) {
      analytics = new Analytics({ date: today });
    }
    
    // Update transaction counts
    analytics.totalRecharges = await Transaction.countDocuments({ 
      type: 'recharge', 
      createdAt: { $gte: today } 
    });
    
    analytics.totalPurchases = await Transaction.countDocuments({ 
      type: 'purchase', 
      createdAt: { $gte: today } 
    });
    
    // Update revenue
    const rechargeRevenue = await Transaction.aggregate([
      { $match: { type: 'recharge', createdAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    analytics.totalRevenue = rechargeRevenue[0]?.total || 0;
    
    // Update request counts
    analytics.pendingRequests = await RechargeRequest.countDocuments({ status: 'pending' });
    analytics.approvedRequests = await RechargeRequest.countDocuments({ status: 'approved' });
    analytics.rejectedRequests = await RechargeRequest.countDocuments({ status: 'rejected' });
    
    await analytics.save();
  } catch (error) {
    console.error('Error updating analytics:', error);
  }
}

module.exports = app;