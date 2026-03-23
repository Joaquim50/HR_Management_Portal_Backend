import cors from "cors";
import express from "express";
import connectDB from "./src/config/db.js";
import dotenv from "dotenv";
import authRoutes from "./src/routes/auth/auth.routes.js";
import candidateRoutes from "./src/routes/candidates/candidate.routes.js";
import userRoutes from "./src/routes/users/user.routes.js";

dotenv.config();

const app = express();

// Connect DataBase
connectDB();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/candidates", candidateRoutes);
app.use("/api/users", userRoutes);

app.get("/", (req, res) => {
    res.send("API Running");
});

const PORT = 2000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));