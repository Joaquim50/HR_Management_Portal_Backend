import xlsx from "xlsx";
import fs from "fs";
import * as sheetService from "../../services/sheet.service.js";
import Candidate from "../../models/candidates/candidate.model.js";

// @desc    Sync candidates from Google Sheets
// @route   POST /api/candidates/sync
// @access  Private (Superadmin only)
export const syncCandidates = async (req, res) => {
    try {
        const { role } = req.body;
        const result = await sheetService.syncSheetData(req.user._id, role);
        res.json({ message: "Sync completed successfully", data: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Bulk import from Excel
// @route   POST /api/candidates/import
// @access  Private (Superadmin only)
export const bulkImportExcel = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Please upload an Excel file" });
        }

        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        const globalRole = req.body.role; // Role sent via multipart form field

        let createdCount = 0;
        let updatedCount = 0;

        for (const row of data) {
            const email = row["Email address"] || row["Email"];
            if (!email) continue;

            const name = row["Full Name"] || row["Name"];
            const phone = row["Phone NO"] || row["Phone Number"];
            const roleInput = row["Role"] || row["Position"];

            // Priority: 1. Global role from body, 2. Role from Excel column, 3. Default "Other"
            let role = "Other";
            if (globalRole) {
                role = globalRole;
            } else if (roleInput) {
                const ri = roleInput.toUpperCase();
                if (ri.includes("JR MERN")) role = "JR MERN";
                else if (ri.includes("SR MERN")) role = "SR MERN";
                else if (ri.includes("HR")) role = "HR";
                else if (ri.includes("QA")) role = "QA";
                else if (ri.includes("DEVOPS")) role = "DevOps";
            }

            const details = new Map();
            Object.keys(row).forEach(key => {
                if (!["Email address", "Email", "Full Name", "Name", "Phone NO", "Phone Number", "Role", "Position"].includes(key)) {
                    details.set(key, row[key]);
                }
            });

            let candidate = await Candidate.findOne({ email });

            if (!candidate) {
                candidate = new Candidate({
                    name,
                    email,
                    phone,
                    role,
                    details,
                    submissionDate: row["Submission Date"] || row["Timestamp"] || new Date().toISOString(),
                    status: "Pending",
                    statusHistory: [{ status: "Pending", changedAt: new Date(), changedBy: req.user._id }]
                });
                await candidate.save();
                createdCount++;
            } else {
                candidate.name = name || candidate.name;
                candidate.phone = phone || candidate.phone;
                candidate.role = role || candidate.role;
                candidate.details = details;
                await candidate.save();
                updatedCount++;
            }
        }

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        res.json({ message: "Import completed", createdCount, updatedCount });
    } catch (error) {
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: error.message });
    }
};

// @desc    Get all candidates
// @route   GET /api/candidates
// @access  Private
export const getCandidates = async (req, res) => {
    try {
        const { role, status, sortBy = "createdAt", order = "desc", page = 1, limit = 10, search } = req.query;

        const query = {};
        if (role) query.role = role;
        if (status) query.status = status;

        // Global Search (Name, Email, Phone, Status, Role)
        if (search) {
            const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            query.$or = [
                { name: { $regex: safeSearch, $options: "i" } },
                { email: { $regex: safeSearch, $options: "i" } },
                { phone: { $regex: safeSearch, $options: "i" } },
                { status: { $regex: safeSearch, $options: "i" } },
                { role: { $regex: safeSearch, $options: "i" } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortOptions = {};
        sortOptions[sortBy] = order === "desc" ? -1 : 1;

        const total = await Candidate.countDocuments(query);
        const candidates = await Candidate.find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit));

        res.json({
            candidates,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Get single candidate
// @route   GET /api/candidates/:id
// @access  Private
export const getCandidateById = async (req, res) => {
    try {
        const candidate = await Candidate.findById(req.params.id)
            .populate("statusHistory.changedBy", "name email")
            .populate("interview.interviewer", "name email");

        if (!candidate) {
            return res.status(404).json({ message: "Candidate not found" });
        }
        res.json(candidate);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Create candidate manually
// @route   POST /api/candidates
// @access  Private
export const createCandidate = async (req, res) => {
    try {
        const { name, email, phone, role, timestamp, ...rest } = req.body || {};
        const candidateExists = await Candidate.findOne({ email });

        if (candidateExists) {
            return res.status(400).json({ message: "Candidate already exists" });
        }

        // Put all other fields into details
        const details = new Map();

        // Collect from top-level 'rest' fields
        Object.keys(rest).forEach(key => {
            if (!["status", "statusHistory", "interview", "submissionDate", "resumeLink", "source", "details"].includes(key)) {
                details.set(key, rest[key]);
            }
        });

        // If 'details' object was explicitly provided, merge its contents
        if (req.body.details && typeof req.body.details === 'object' && !(req.body.details instanceof Array)) {
            Object.keys(req.body.details).forEach(key => {
                details.set(key, req.body.details[key]);
            });
        }

        const candidate = new Candidate({
            name,
            email,
            phone,
            role: role || "Other",
            submissionDate: timestamp || req.body.submissionDate || new Date().toISOString(),
            details,
            status: req.body.status || "Pending",
            statusHistory: [{
                status: req.body.status || "Pending",
                changedAt: new Date(),
                changedBy: req.user._id
            }]
        });

        await candidate.save();
        res.status(201).json(candidate);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Update candidate status
// @route   PATCH /api/candidates/:id/status
// @access  Private
export const updateCandidateStatus = async (req, res) => {
    try {
        const { status } = req.body || {};
        const candidate = await Candidate.findById(req.params.id);

        if (!candidate) {
            return res.status(404).json({ message: "Candidate not found" });
        }

        if (candidate.status !== status) {
            candidate.status = status;
            candidate.statusHistory.push({
                status: status,
                changedAt: new Date(),
                changedBy: req.user._id
            });
            await candidate.save();
        }

        res.json(candidate);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Delete candidate
// @route   DELETE /api/candidates/:id
// @access  Private (Superadmin only)
export const deleteCandidate = async (req, res) => {
    try {
        const candidate = await Candidate.findByIdAndDelete(req.params.id);
        if (!candidate) {
            return res.status(404).json({ message: "Candidate not found" });
        }
        res.json({ message: "Candidate removed" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
