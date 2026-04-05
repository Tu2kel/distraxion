const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");

    if (!authHeader) {
      return res.status(401).json({ msg: "No token, authorization denied" });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ msg: "Invalid token format" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ msg: "Token missing" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Standard users: { id }
    // SuperUser tokens: { id, isSuperUser, tier, tierRegion, name, ... }
    req.user = decoded;

    next();
  } catch (err) {
    return res.status(401).json({ msg: "Token is not valid or expired" });
  }
};
