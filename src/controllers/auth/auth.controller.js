import User from "../../models/users/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendMail } from "../../services/email.service.js";

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
            user: { 
                id: user._id, 
                name: user.name, 
                email: user.email, 
                role: user.role, 
                permissions: user.permissions,
                isInterviewer: user.isInterviewer 
            } 
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
        
        user.refreshTokens.push(refreshToken);
        await user.save();

        res.json({ 
            accessToken, 
            refreshToken, 
            user: { 
                id: user._id, 
                name: user.name, 
                email: user.email, 
                role: user.role, 
                permissions: user.permissions,
                isInterviewer: user.isInterviewer 
            } 
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

export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });

        // Explicit error if user not found (as requested by user)
        if (!user) {
            return res.status(404).json({ message: "User with this email not found" });
        }

        if (!user.active) {
            return res.status(400).json({ message: "Account is inactive. Please contact admin." });
        }

        // Generate token
        const rawToken = crypto.randomBytes(32).toString("hex");

        // Hash token before saving
        const hashedToken = crypto
            .createHash("sha256")
            .update(rawToken)
            .digest("hex");

        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 min

        await user.save();

        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;

        const subject = "Reset your password";
        const body = `
Hello ${user.name || "User"},

We received a request to reset your password.

Click the link below to set a new password:
${resetLink}

This link will expire in 15 minutes.

If you did not request this, please ignore this email.
        `;

        await sendMail({
            to: user.email,
            subject,
            body
        });

        res.json({
            message: "Password reset instructions have been sent to your email."
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const verifyResetToken = async (req, res) => {
    try {
        const { token } = req.params;

        if (!token) {
            return res.status(400).json({ message: "Token is required" });
        }

        // Hash incoming token
        const hashedToken = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired token" });
        }

        res.json({ message: "Token is valid" });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
export const resetPassword = async (req, res) => {
    try {
        const { token, password, confirmPassword } = req.body;

        if (!token) {
            return res.status(400).json({ message: "Invalid or missing token" });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ message: "Passwords do not match" });
        }

        // Hash incoming token
        const hashedToken = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired token" });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        // Clear reset fields
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        // 🔐 IMPORTANT: invalidate all sessions
        user.refreshTokens = [];

        await user.save();

        res.json({ message: "Password reset successfully" });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};