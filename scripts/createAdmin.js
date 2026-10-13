// Load environment variables
import 'dotenv/config';

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cartiva';

async function createAdmin() {
  // Read arguments from command line or use safe defaults
  // Usage: node scripts/createAdmin.js [name] [username] [password]
  const args = process.argv.slice(2);
  const adminName = args[0] || 'Cartiva Administrator';
  const adminUsername = (args[1] || 'admin').trim().toLowerCase();
  const adminPassword = args[2] || 'admin123456';

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB:', MONGODB_URI);

    // Check if a user with this username already exists
    const existingUser = await User.findOne({ username: adminUsername });

    if (existingUser) {
      console.log(`User with username "${adminUsername}" already exists.`);
      // Update role to admin and refresh password
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      existingUser.name = adminName;
      existingUser.role = 'admin';
      existingUser.passwordHash = passwordHash;
      await existingUser.save();

      console.log(`✓ Updated existing account to Administrator role.`);
    } else {
      // Hash password and create new admin
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      const newAdmin = new User({
        name: adminName,
        username: adminUsername,
        passwordHash: passwordHash,
        role: 'admin'
      });

      await newAdmin.save();
      console.log(`✓ New Administrator created successfully!`);
    }

    console.log('\n===============================================');
    console.log('Administrator Credentials:');
    console.log(`  Name:     ${adminName}`);
    console.log(`  Username: ${adminUsername}`);
    console.log(`  Password: ${adminPassword}`);
    console.log(`  Role:     admin`);
    console.log('===============================================');
    console.log('You can now log in at: http://localhost:3000/login\n');
  } catch (error) {
    console.error('✗ Error creating admin account:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

createAdmin();
