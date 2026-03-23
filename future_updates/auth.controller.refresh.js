import User from "../../models/users/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Helper to generate both tokens
const generateTokens = (user) => {
    const accessToken = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "15m" } // Short-lived access token
    );

    const refreshToken = jwt.sign(
        { id: user._id },
        process.env.JWT_REFRESH_SECRET || "fallback_refresh_secret",
        { expiresIn: "7d" } // Long-lived refresh token
    );

    return { accessToken, refreshToken };
};

export const register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: "User already exists" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({ name, email, password: hashedPassword, role });
        
        const { accessToken, refreshToken } = generateTokens(user);
        user.refreshToken = refreshToken;
        await user.save();

        res.status(201).json({ accessToken, refreshToken, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "User not found" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid Credentials" });

        const { accessToken, refreshToken } = generateTokens(user);
        user.refreshToken = refreshToken;
        await user.save();

        res.json({ accessToken, refreshToken, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

export const refreshToken = async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(401).json({ message: "Refresh Token is required" });

    try {
        const user = await User.findOne({ refreshToken: token });
        if (!user) return res.status(403).json({ message: "Invalid refresh token" });

        jwt.verify(token, process.env.JWT_REFRESH_SECRET || "fallback_refresh_secret", (err, decoded) => {
            if (err) return res.status(403).json({ message: "Token expired or invalid" });

            const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
            user.refreshToken = newRefreshToken;
            user.save();

            res.json({ accessToken, refreshToken: newRefreshToken });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
