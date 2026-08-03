import db from '../config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JWT_SECRET } from '../config/jwt.js';

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

// Generates a random human-typeable temporary password (e.g. "K7F2-93QZ")
function generateTempPassword() {
  return crypto.randomBytes(4).toString('hex').toUpperCase().match(/.{1,4}/g).join('-');
}

// Register user (Admin only, or open for initial registration)
export async function registerUser(req, res) {
  try {
    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !phone || !role) {
      return res.status(400).json({ message: 'Name, email, phone, and role are required.' });
    }

    if (role !== 'borrower' && !password) {
      return res.status(400).json({ message: 'Password is required for administrators and collection agents.' });
    }

    if (!['admin', 'agent', 'borrower'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role specified.' });
    }

    // Check if email or phone already exists
    const existingUser = await db('users').where({ email }).orWhere({ phone }).first();
    if (existingUser) {
      return res.status(400).json({ 
        message: existingUser.email === email 
          ? 'Email is already registered.' 
          : 'Phone number is already registered.' 
      });
    }

    // Hash password. Borrowers without an explicit password get a random
    // temporary one (never a shared, guessable default) and must change it
    // on first login.
    let passwordHash;
    let tempPassword = null;
    let mustChangePassword = false;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(password, salt);
    } else if (role === 'borrower') {
      tempPassword = generateTempPassword();
      mustChangePassword = true;
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(tempPassword, salt);
    } else {
      passwordHash = 'NO_LOGIN_ACCESS';
    }

    // Insert user
    const [userId] = await db('users').insert({
      name,
      email,
      phone,
      password_hash: passwordHash,
      role,
      is_active: true,
      must_change_password: mustChangePassword
    }).returning('id');

    // Create Audit Log
    const creatorId = req.user ? req.user.id : null;
    await db('audit_logs').insert({
      actor_id: creatorId,
      action_type: 'USER_REGISTRATION',
      description: `Registered new user '${name}' with role '${role}'.`
    });

    res.status(201).json({
      message: 'User registered successfully.',
      userId: userId.id || userId,
      temporaryPassword: tempPassword
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error during registration.' });
  }
}

// User Login
export async function loginUser(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    // Find user
    const user = await db('users').where({ email }).first();
    if (!user || !user.is_active) {
      return res.status(401).json({ message: 'Invalid email or inactive account.' });
    }

    // Account lockout: block login while locked, regardless of password correctness
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(423).json({ message: `Account temporarily locked due to repeated failed logins. Try again in ${minutesLeft} minute(s).` });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      const update = { failed_login_attempts: attempts };
      if (attempts >= LOGIN_MAX_ATTEMPTS) {
        update.locked_until = new Date(Date.now() + LOGIN_LOCKOUT_MS);
        update.failed_login_attempts = 0;
      }
      await db('users').where({ id: user.id }).update(update);

      if (update.locked_until) {
        return res.status(423).json({ message: 'Too many failed login attempts. Account locked for 15 minutes.' });
      }
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Reset lockout counters on successful login
    if (user.failed_login_attempts || user.locked_until) {
      await db('users').where({ id: user.id }).update({ failed_login_attempts: 0, locked_until: null });
    }

    // Create JWT
    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Record login audit log
    await db('audit_logs').insert({
      actor_id: user.id,
      action_type: 'USER_LOGIN',
      description: `User '${user.name}' logged in successfully.`
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        mustChangePassword: !!user.must_change_password
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error during login.' });
  }
}

// Get all agents
export async function getAgents(req, res) {
  try {
    const agents = await db('users').where({ role: 'agent', is_active: true }).select('id', 'name', 'email', 'phone');
    res.json(agents);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch agents.' });
  }
}

// Get all borrowers
export async function getBorrowers(req, res) {
  try {
    const borrowers = await db('users').where({ role: 'borrower', is_active: true }).select('id', 'name', 'email', 'phone');
    res.json(borrowers);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch borrowers.' });
  }
}

// Self-service password change (any authenticated role)
export async function changePassword(req, res) {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ message: 'Current password and new password are required.' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
    }

    const user = await db('users').where({ id: req.user.id }).first();
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(new_password, salt);

    await db('users').where({ id: user.id }).update({
      password_hash: passwordHash,
      must_change_password: false,
      updated_at: db.fn.now()
    });

    await db('audit_logs').insert({
      actor_id: user.id,
      action_type: 'CHANGE_PASSWORD',
      description: `User '${user.name}' changed their own password.`
    });

    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Internal server error while changing password.' });
  }
}

// Admin-triggered password reset for any user
export async function resetUserPassword(req, res) {
  try {
    const { id } = req.params;

    const targetUser = await db('users').where({ id }).first();
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const tempPassword = generateTempPassword();
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(tempPassword, salt);

    await db('users').where({ id }).update({
      password_hash: passwordHash,
      must_change_password: true,
      failed_login_attempts: 0,
      locked_until: null,
      updated_at: db.fn.now()
    });

    await db('audit_logs').insert({
      actor_id: req.user.id,
      action_type: 'RESET_PASSWORD',
      description: `Admin reset the password for user '${targetUser.name}' (${targetUser.role}).`
    });

    res.json({
      message: 'Password reset successfully. Share the temporary password with the user securely.',
      temporaryPassword: tempPassword
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Internal server error while resetting password.' });
  }
}

// List all users (Admin only), optionally filtered by role
export async function listUsers(req, res) {
  try {
    const { role } = req.query;
    let query = db('users').select('id', 'name', 'email', 'phone', 'role', 'is_active', 'must_change_password', 'created_at');
    if (role) {
      query = query.where({ role });
    }
    const users = await query.orderBy('created_at', 'desc');
    res.json(users);
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ message: 'Failed to fetch users.' });
  }
}

// Toggle a user's active status (Admin only)
export async function setUserStatus(req, res) {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ message: 'is_active (boolean) is required.' });
    }
    if (id === req.user.id) {
      return res.status(400).json({ message: 'You cannot change your own active status.' });
    }

    const targetUser = await db('users').where({ id }).first();
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    await db('users').where({ id }).update({ is_active, updated_at: db.fn.now() });

    await db('audit_logs').insert({
      actor_id: req.user.id,
      action_type: 'USER_STATUS_CHANGE',
      description: `Admin ${is_active ? 'activated' : 'deactivated'} user '${targetUser.name}' (${targetUser.role}).`
    });

    res.json({ message: `User ${is_active ? 'activated' : 'deactivated'} successfully.` });
  } catch (error) {
    console.error('Set user status error:', error);
    res.status(500).json({ message: 'Failed to update user status.' });
  }
}
