
import {z} from 'zod';

const userSchema = z.object({
    name: z.string().min(1, {message: "Name is required"}),
    email: z.string().email({message: "Invalid email address"}),
    password: z.string().min(6, {message: "Password must be at least 6 characters long"}),
    phone: z.string()
        .trim()
        .regex(/^\+[1-9]\d{7,14}$/, {message: "Phone number must include the country code, e.g. +256760123456"})
        .optional()
});

const createUserSchema = z.union([
    userSchema,
    z.array(userSchema)
        .min(1, {message: "At least one user is required"})
        .max(10, {message: "No more than 10 users can be registered at once"})
]);
const updateUserSchema = userSchema.partial().refine(
    (user) => Object.keys(user).length > 0,
    {message: "At least one field must be provided"}
);
const loginSchema = z.object({
    email: z.string().email({message: "Invalid email address"}),
    password: z.string().min(1, {message: "Password is required"})
});

const createValidator = (schema) => (req, res, next) => {
    const results = schema.safeParse(req.body);
    if (results.error) {
        return res.status(400).json({ message: results.error.issues[0].message });
    }
    req.body = results.data;
    next();
};

export const validateUserReplacement = createValidator(userSchema);
export const validateUserUpdate = createValidator(updateUserSchema);
export const validateLogin = createValidator(loginSchema);
export default createValidator(createUserSchema);