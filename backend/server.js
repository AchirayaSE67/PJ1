require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');

const { errorHandler } = require('./middleware/errorHandler');
const rentalService = require('./services/rentalService');
const topupModel = require('./models/topupModel');

const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const computerRoutes = require('./routes/computerRoutes');
const rentalRoutes = require('./routes/rentalRoutes');
const walletRoutes = require('./routes/walletRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const adminRoutes = require('./routes/adminRoutes');
const accessRoutes = require('./routes/accessRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/computers', computerRoutes);
app.use('/api/rentals', rentalRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/access', accessRoutes);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/', (req, res) => {
  res.redirect('/pages/index.html');
});

app.use(errorHandler);

app.listen(PORT, async () => {
  console.log(`PC Rental server: http://localhost:${PORT}`);
  try { await topupModel.ensureTable(); } catch (err) { console.error('Topup table:', err.message); }
  rentalService.startSessionWatcher();
  setInterval(() => topupModel.expireOld().catch(() => {}), 30000);
});
