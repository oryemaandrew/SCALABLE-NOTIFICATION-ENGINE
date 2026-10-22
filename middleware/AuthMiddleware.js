
import jwt from 'jsonwebtoken';
const AuthMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
if (!authHeader) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    // Here you can add logic to verify the token if needed
    const token = authHeader.split(' ')[1];

    try{
        const decoded = jwt.verify(token,process.env.JWT_Secret);
        req.user = decoded;
        next();

    }
    catch{
        return res.status(403).json({message:'invalid_token'});

    }
   
}
export default AuthMiddleware;
