import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';
import { notificationQueue } from '../queueConfig.js'; // 👈 Your BullMQ import

const parseUserId = (value) =>
  (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null);

// GET /api/users
export const getCurrentUser = async (req, res) => {
  try {
    const userId = parseUserId(req.user?.sub);

    if (userId === null) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);
  } 
  catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const createUser = async (req, res) => {
  try {
    const jwtSecret = process.env.JWT_Secret;

    if (!jwtSecret) {
      return res.status(500).json({ message: 'JWT signing secret is not configured' });
    }

    const payload = Array.isArray(req.body) ? req.body : [req.body];

    if (payload.some(({ name, email, password }) => !name || !email || !password)) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const saltRounds = 10;
    const rows = await Promise.all(
      payload.map(async ({ name, email, password, phone }) => ({
        name,
        email,
        password: await bcrypt.hash(password, saltRounds),
        phone: phone?.trim() || null
      }))
    );

    // 1. Create all users simultaneously in your database
    const result = await prisma.user.createMany({
      data: rows
    });

    const createdUsers = await prisma.user.findMany({
      where: {
        email: {
          in: rows.map(({ email }) => email)
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true
      }
    });

    // Queue failures must not make a completed account creation look rolled back.
    const notificationResults = await Promise.allSettled(
      createdUsers.map(user =>
        Promise.resolve().then(() =>
          notificationQueue.add("SendWelcomeNotification", {
            email: user.email,
            name: user.name,
            phone: user.phone,
            type: user.phone ? "EMAIL_AND_SMS" : "EMAIL"
          })
        )
      )
    );
    const queuedNotifications = notificationResults.filter(
      result => result.status === 'fulfilled'
    ).length;
    const failedNotifications = notificationResults.length - queuedNotifications;

    if (failedNotifications > 0) {
      notificationResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(
            `Failed to queue welcome notification for user ${createdUsers[index].id}:`,
            result.reason
          );
        }
      });
    }

    const tokens = createdUsers.map(user => ({
      userId: user.id,
      email: user.email,
      token: jwt.sign(
        { sub: user.id },
        jwtSecret,
        { expiresIn: '7h' }
      )
    }));

    // 3. Return response back to Thunder Client instantly
    res.status(201).json({
      message: `${result.count} users created successfully`,
      notifications: {
        queued: queuedNotifications,
        failed: failedNotifications
      },
      ...(tokens.length === 1
        ? { userId: tokens[0].userId, token: tokens[0].token }
        : { tokens })
    });
  } 
  catch (error) {
    console.error('User registration failed:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'An account with that email already exists' });
    }
    res.status(500).json({ message: 'Unable to register user right now' });
  }
};

// POST /api/users/login
export const loginUser = async (req, res) => {
  try {
    const jwtSecret = process.env.JWT_Secret;

    if (!jwtSecret) {
      console.error('JWT_Secret is not configured');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { sub: user.id },
      jwtSecret,
      { expiresIn: '7h' }
    );

    res.status(200).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ message: 'Unable to log in right now' });
  }
};

// DELETE /api/users/:id
export const deleteUser = async (req, res) => {
  try {
    const id = parseUserId(req.params.id);

    if (id === null) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    // Prisma deletes directly. If the ID doesn't exist, it throws an error code 'P2025'
    await prisma.user.delete({
      where: {
        id
      }
    });

    res.status(200).json({ message: 'User deleted successfully' });
  } 
  catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/users/:id
export const updateUser = async (req, res) => {
  try {
    const userId = parseUserId(req.params.id);

    if (userId === null) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const updatedData = req.body;

    // 🛡️ SECURITY CHECK: If they update the password, hash it!
    if (updatedData.password) {
      updatedData.password = await bcrypt.hash(updatedData.password, 10);
    }

    const data = await prisma.user.update({
      where: {
        id: userId
      },
      data: updatedData
    });

    delete data.password; // Hide password hash from response
    res.json(data);
  } 
  catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(500).json({ message: error.message });
  }
};

// GET /api/users/:id
export const getUserById = async (req, res) => {
  try {
    const userId = parseUserId(req.params.id);

    if (userId === null) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } 
  catch (error) {
    res.status(500).json({ message: error.message });
  }
};
