import xlsx from "xlsx";
import fs from "fs";
import * as sheetService from "../../services/sheet.service.js";
import Candidate from "../../models/candidates/candidate.model.js";
import { updateJobStats } from "../../utils/jobUtils.js";

// @desc    Sync candidates from Google Sheets
// @route   POST /api/candidates/sync
// @access  Private (Superadmin only)
export const syncCandidates = async (req, res) => {
    try {
        const { role, sheetId } = req.body;
        const result = await sheetService.syncSheetData(req.user._id, role, sheetId);
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
        let skippedCount = 0;

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

            // Extract experience based on keywords
            let experience = "0";
            Object.keys(row).forEach(key => {
                const k = key.toLowerCase();
                if (k.includes("experience") || k.includes("work exp") || k.includes("years of")) {
                    if (experience === "0" || !experience) {
                        experience = String(row[key]);
                    }
                }
            });

            const details = {};
            Object.keys(row).forEach(key => {
                const k = key.trim();
                if (!["Email address", "Email", "Full Name", "Name", "Phone NO", "Phone Number", "Role", "Position"].includes(k)) {
                    const cleanKey = k.replace(/\./g, "_");
                    details[cleanKey] = row[key];
                }
            });

            let candidate = await Candidate.findOne({ email });

            if (candidate) {
                skippedCount++;
                continue;
            }

            candidate = new Candidate({
                name,
                email,
                phone,
                role,
                experience,
                details,
                submissionDate: row["Submission Date"] || row["Timestamp"] || new Date().toISOString(),
                status: "Pending",
                statusHistory: [{ status: "Pending", changedAt: new Date(), changedBy: req.user._id }]
            });
            await candidate.save();
            createdCount++;

            // Recalculate job stats
            if (candidate.role) {
                await updateJobStats(candidate.role);
            }
        }

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        res.json({ message: "Import completed", createdCount, updatedCount, skippedCount });
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
        const { 
            role, 
            status, 
            stage, // Alias for status
            type, // Intern, Fresher, Experienced, etc.
            noticePeriod, 
            sortBy = "createdAt", 
            order = "desc", 
            page = 1, 
            limit = 10, 
            search 
        } = req.query;

        const query = {};

        // Role Filter (Exact or partial match)
        if (role && role !== "All") {
            const safeRole = role.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            query.role = { $regex: safeRole, $options: "i" };
        }

        // Stage/Status Filter
        const targetStatus = status || stage;
        if (targetStatus && targetStatus !== "All Stages") {
            query.status = targetStatus;
        }

        // Candidate Type Filter (Fresher, Experienced, Intern, Immediate Joiner, Backup)
        if (type && type !== "All") {
            if (type === "Fresher") {
                query.experience = { $regex: /^0/, $options: "i" };
            } else if (type === "Experienced") {
                query.experience = { $ne: "0", $exists: true };
            } else if (type === "Immediate Joiner") {
                query["details.Notice Period"] = { $regex: /Immediate/i };
            } else if (type === "Intern") {
                query.role = { $regex: /Intern/i };
            } else if (type === "Backup") {
                query.status = "Backup";
            }
        }

        // Notice Period Filter
        if (noticePeriod && noticePeriod !== "All") {
            const safeNotice = noticePeriod.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            query["details.Notice Period"] = { $regex: safeNotice, $options: "i" };
        }

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
            if (req.file) fs.unlinkSync(req.file.path);
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
            resumeLink: req.file ? req.file.path : (req.body.resumeLink || ""),
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
        if (req.file) fs.unlinkSync(req.file.path);
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
            candidate.statusHistory.push({
                status: status,
                changedAt: new Date(),
                changedBy: req.user._id
            });

            // Delete resume file if rejected
            if (status === "Rejected" && candidate.resumeLink && candidate.resumeLink.startsWith("uploads")) {
                try {
                    if (fs.existsSync(candidate.resumeLink)) {
                        fs.unlinkSync(candidate.resumeLink);
                    }
                    candidate.resumeLink = ""; // Clear the link after deletion
                } catch (err) {
                    console.error("Error deleting resume file:", err.message);
                }
            }
            
            const oldRole = candidate.role; // Store old role before updating status
            candidate.status = status; // Update status after old role is captured
            await candidate.save();

            // Recalculate job stats for old and new roles if role changed or status changed
            if (oldRole) {
                await updateJobStats(oldRole);
            }
            if (candidate.role && candidate.role !== oldRole) {
                await updateJobStats(candidate.role);
            }
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
        const candidate = await Candidate.findById(req.params.id);
        if (!candidate) {
            return res.status(404).json({ message: "Candidate not found" });
        }

        // Delete resume file if exists
        if (candidate.resumeLink && candidate.resumeLink.startsWith("uploads")) {
            try {
                if (fs.existsSync(candidate.resumeLink)) {
                    fs.unlinkSync(candidate.resumeLink);
                }
            } catch (err) {
                console.error("Error deleting resume file during deletion:", err.message);
            }
        }

        await Candidate.findByIdAndDelete(req.params.id);
        res.json({ message: "Candidate removed" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
