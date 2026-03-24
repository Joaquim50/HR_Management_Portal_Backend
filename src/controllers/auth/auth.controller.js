import User from "../../models/users/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Generate Tokens Helper
const generateTokens = (user) => {
    const accessToken = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_ACCESS_EXPIRATION || "15m" }
    );
    const refreshToken = jwt.sign(
        { id: user._id },
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRATION || "7d" }
    );
    return { accessToken, refreshToken };
};

// Register User
export const register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: "User already exists" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({
            name,
            email,
            password: hashedPassword,
            role
        });

        const { accessToken, refreshToken } = generateTokens(user);
        user.refreshTokens = [refreshToken];
        await user.save();

        res.status(201).json({ 
            accessToken, 
            refreshToken, 
            user: { id: user._id, name: user.name, email: user.email, role: user.role } 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Login User
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "User not found" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid Credentials" });

        const { accessToken, refreshToken } = generateTokens(user);
        
        // Add new refresh token to user (support multiple devices)
        user.refreshTokens.push(refreshToken);
        await user.save();

        res.json({ 
            accessToken, 
            refreshToken, 
            user: { id: user._id, name: user.name, email: user.email, role: user.role } 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Refresh Token
export const refreshToken = async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(401).json({ message: "Refresh Token required" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user || !user.refreshTokens.includes(token)) {
            return res.status(403).json({ message: "Invalid Refresh Token" });
        }

        // Generate new access token
        const accessToken = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_ACCESS_EXPIRATION || "15m" }
        );

        res.json({ accessToken });
    } catch (err) {
        res.status(403).json({ message: "Refresh Token expired or invalid" });
    }
};

// Logout
export const logout = async (req, res) => {
    const { token } = req.body;
    try {
        const user = await User.findById(req.user.id);
        if (user) {
            user.refreshTokens = user.refreshTokens.filter(t => t !== token);
            await user.save();
        }
        res.status(200).json({ message: "Logged out successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get current user profile
export const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};