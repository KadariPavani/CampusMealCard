const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mealcard', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Import schemas
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'manager', 'cashier', 'student'], required: true },
  studentId: { type: String, unique: true, sparse: true },
  createdAt: { type: Date, default: Date.now },
});

const mealCardSchema = new mongoose.Schema({
  cardNumber: { type: String, required: true, unique: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  balance: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const mealSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  isAvailable: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);
const MealCard = mongoose.model('MealCard', mealCardSchema);
const Meal = mongoose.model('Meal', mealSchema);

async function seedDatabase() {
  try {
    // Clear existing data
    await User.deleteMany({});
    await MealCard.deleteMany({});
    await Meal.deleteMany({});

    console.log('Cleared existing data');

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = new User({
      name: 'System Admin',
      email: 'admin@university.edu',
      password: adminPassword,
      role: 'admin',
    });
    await admin.save();

    // Create manager users
    const managers = [];
    for (let i = 1; i <= 2; i++) {
      const managerPassword = await bcrypt.hash('manager123', 10);
      const manager = new User({
        name: `Manager ${i}`,
        email: `manager${i}@university.edu`,
        password: managerPassword,
        role: 'manager',
      });
      await manager.save();
      managers.push(manager);
    }

    // Create cashier users
    const cashiers = [];
    for (let i = 1; i <= 3; i++) {
      const cashierPassword = await bcrypt.hash('cashier123', 10);
      const cashier = new User({
        name: `Cashier ${i}`,
        email: `cashier${i}@university.edu`,
        password: cashierPassword,
        role: 'cashier',
      });
      await cashier.save();
      cashiers.push(cashier);
    }

    // Create sample students
    const students = [];
    for (let i = 1; i <= 20; i++) {
      const studentPassword = await bcrypt.hash('student123', 10);
      const student = new User({
        name: `Student ${i}`,
        email: `student${i}@university.edu`,
        password: studentPassword,
        role: 'student',
        studentId: `STU${2024000 + i}`,
      });
      await student.save();
      students.push(student);

      // Create meal card for each student with initial balance
      const mealCard = new MealCard({
        cardNumber: `CARD${Date.now() + i}`,
        studentId: student._id,
        balance: Math.floor(Math.random() * 500) + 100, // Random balance between 100-600
      });
      await mealCard.save();
    }

    // Create sample meals
    const meals = [
      { name: 'Chicken Burger', price: 150, category: 'Main Course' },
      { name: 'Vegetable Sandwich', price: 80, category: 'Main Course' },
      { name: 'Pasta', price: 120, category: 'Main Course' },
      { name: 'French Fries', price: 60, category: 'Snacks' },
      { name: 'Coffee', price: 30, category: 'Beverages' },
      { name: 'Tea', price: 20, category: 'Beverages' },
      { name: 'Orange Juice', price: 40, category: 'Beverages' },
      { name: 'Pizza Slice', price: 100, category: 'Main Course' },
      { name: 'Samosa', price: 25, category: 'Snacks' },
      { name: 'Ice Cream', price: 50, category: 'Desserts' },
      { name: 'Chicken Biryani', price: 180, category: 'Main Course' },
      { name: 'Vegetable Biryani', price: 120, category: 'Main Course' },
      { name: 'Chicken Roll', price: 90, category: 'Snacks' },
      { name: 'Paneer Tikka', price: 140, category: 'Snacks' },
      { name: 'Lassi', price: 40, category: 'Beverages' },
    ];

    for (const mealData of meals) {
      const meal = new Meal(mealData);
      await meal.save();
    }

    console.log('Database seeded successfully!');
    console.log('\nDefault login credentials:');
    console.log('Admin: admin@university.edu / admin123');
    console.log('Managers: manager1@university.edu to manager2@university.edu / manager123');
    console.log('Cashiers: cashier1@university.edu to cashier3@university.edu / cashier123');
    console.log('Students: student1@university.edu to student20@university.edu / student123');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();