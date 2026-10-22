const requireSelf = (req, res, next) => {
  const tokenUserId = req.user?.sub;
  const requestedUserId = req.params.id;

  if (!tokenUserId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (tokenUserId.toLowerCase() !== requestedUserId.toLowerCase()) {
    return res.status(403).json({ message: 'You can only access your own account' });
  }

  next();
};

export default requireSelf;