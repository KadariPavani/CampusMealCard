const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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

// Recharge Request Schema
const rechargeRequestSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'MealCard', required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
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
  createdAt: { type: Date, default: Date.now },
});

// Models
const User = mongoose.model('User', userSchema);
const MealCard = mongoose.model('MealCard', mealCardSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const RechargeRequest = mongoose.model('RechargeRequest', rechargeRequestSchema);
const Meal = mongoose.model('Meal', mealSchema);

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
    const card = await MealCard.findOne({ studentId: req.user.userId });
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

app.post('/api/student/recharge-request', authenticateToken, authorize(['student']), async (req, res) => {
  try {
    const { amount } = req.body;
    
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
    });

    await rechargeRequest.save();
    res.status(201).json({ message: 'Recharge request submitted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Manager Routes
app.get('/api/manager/recharge-requests', authenticateToken, authorize(['manager', 'admin']), async (req, res) => {
  try {
    const requests = await RechargeRequest.find({ status: 'pending' })
      .populate('studentId', 'name email studentId')
      .populate('cardId', 'cardNumber')
      .sort({ requestedAt: -1 });
    
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/manager/recharge-requests/:id/approve', authenticateToken, authorize(['manager', 'admin']), async (req, res) => {
  try {
    const request = await RechargeRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    request.status = 'approved';
    request.processedBy = req.user.userId;
    request.processedAt = new Date();
    await request.save();

    // Update card balance
    const card = await MealCard.findById(request.cardId);
    card.balance += request.amount;
    await card.save();

    // Create transaction record
    const transaction = new Transaction({
      cardId: request.cardId,
      type: 'recharge',
      amount: request.amount,
      description: 'Recharge approved by manager',
      processedBy: req.user.userId,
    });
    await transaction.save();

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
    const users = await User.find().select('-password');
    res.json(users);
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
app.post('/api/admin/meals', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const { name, price, category } = req.body;
    const meal = new Meal({ name, price, category });
    await meal.save();
    res.status(201).json(meal);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/meals', authenticateToken, async (req, res) => {
  try {
    const meals = await Meal.find();
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});