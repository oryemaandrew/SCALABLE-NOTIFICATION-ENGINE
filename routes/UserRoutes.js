import express from 'express';
import { rateLimit } from 'express-rate-limit';
const router = express.Router();
import AuthMiddlware from '../middleware/AuthMiddleware.js';
import validateUser, {validateLogin, validateUserReplacement, validateUserUpdate} from '../middleware/validateuser.js';
import requireSelf from '../middleware/requireSelf.js';

import {getCurrentUser, getUserById, createUser, loginUser, updateUser, deleteUser} from '../controllers/UserControllers.js';

export const registrationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // Limit each IP to 5 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { 
    message: 'Too many registration attempts. Try again in 15 minutes.' 
  }
});


router.get('/', AuthMiddlware, getCurrentUser);
router.post('/login', validateLogin, loginUser);
router.post('/',validateUser, createUser);
router.get('/:id', AuthMiddlware, requireSelf, getUserById);
router.put('/:id', AuthMiddlware, requireSelf, validateUserReplacement, updateUser);
router.delete('/:id', AuthMiddlware, requireSelf, deleteUser);
router.patch('/:id', AuthMiddlware, requireSelf, validateUserUpdate, updateUser);
export default router;
