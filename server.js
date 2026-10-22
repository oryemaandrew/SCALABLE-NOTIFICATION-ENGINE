import express from 'express';
import cors from 'cors';
import "./queueConfig.js";             
import "./notificationWorker.js"; 

// 1. Import BOTH the default router and the named rate limiter in ONE clean line!
import UserRoutes, { registrationRateLimit } from './routes/UserRoutes.js';

const app = express(); // 2. App must be initialized before setting proxy configurations!

app.set('trust proxy', 1); 
app.use(express.json());
app.use(cors());

// 3. This successfully applies the limiter to your routes
app.use('/api/users', registrationRateLimit, UserRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
