import xlsx from "xlsx";
import fs from "fs";
import * as sheetService from "../../services/sheet.service.js";
import Candidate from "../../models/candidates/candidate.model.js";
import { updateJobStats } from "../../utils/jobUtils.js";
import Activity from "../../models/dashboard/activity.model.js";

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

            // Map detailed fields from row
            let candidateType = "Other";
            let totalExperience = "";
            let relevantExperience = "";
            let noticePeriod = "";
            let currentCTC = "";
            let expectedCTC = "";
            let location = "";
            let source = "Excel Import";

            Object.keys(row).forEach(key => {
                const k = key.toLowerCase().trim();
                const v = String(row[key]);
                if (k.includes("candidate type") || k === "type") candidateType = v;
                else if (k === "total experience" || k === "experience" || k === "work exp") totalExperience = v;
                else if (k.includes("relevant experience")) relevantExperience = v;
                else if (k.includes("notice period")) noticePeriod = v;
                else if (k.includes("current ctc") || k === "ctc") currentCTC = v;
                else if (k.includes("expected ctc") || k === "expected") expectedCTC = v;
                else if (k === "location" || k === "current city") location = v;
                else if (k === "source" || k.includes("how did you hear")) source = v;
            });

            const details = {};
            const coreFields = [
                "Email address", "Email", "Full Name", "Name", "Phone NO", "Phone Number", 
                "Role", "Position", "Candidate Type", "Type",
                "Total Experience", "Experience", "Work Exp", "Relevant Experience",
                "Notice Period", "Current CTC", "CTC", "Expected CTC", "Expected",
                "Location", "Current City", "Source", "Submission Date", "Timestamp"
            ];

            Object.keys(row).forEach(key => {
                const k = key.trim();
                if (!coreFields.some(f => k.toLowerCase().includes(f.toLowerCase()))) {
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
                candidateType,
                totalExperience,
                relevantExperience,
                noticePeriod,
                currentCTC,
                expectedCTC,
                location,
                source,
                details,
                submissionDate: row["Submission Date"] || row["Timestamp"] || new Date().toISOString(),
                status: "New",
                statusHistory: [{ status: "New", changedAt: new Date(), changedBy: req.user._id }]
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
        if (type && type !== "All" && type !== "All Types") {
            const typeCriteria = [];
            
            // 1. Check candidateType field (exact match after mapping)
            typeCriteria.push({ candidateType: type });

            // 2. Check tags (exact or partial)
            typeCriteria.push({ tags: type });

            // 3. Fallback to behavioral patterns (backward compatibility)
            if (type === "Fresher") {
                typeCriteria.push({ totalExperience: { $regex: /^0/, $options: "i" } });
                typeCriteria.push({ relevantExperience: { $regex: /^0/, $options: "i" } });
            } else if (type === "Experienced") {
                typeCriteria.push({ totalExperience: { $ne: "0", $exists: true } });
            } else if (type === "Immediate Joiner") {
                typeCriteria.push({ noticePeriod: { $regex: /Immediate/i } });
            } else if (type === "Intern") {
                typeCriteria.push({ role: { $regex: /Intern/i } });
            } else if (type === "Backup") {
                typeCriteria.push({ status: "Backup" });
            }

            // Apply as $or
            query.$or = query.$or ? [...query.$or, { $or: typeCriteria }] : [{ $or: typeCriteria }];
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
                { role: { $regex: safeSearch, $options: "i" } },
                { tags: { $regex: safeSearch, $options: "i" } },
                { candidateType: { $regex: safeSearch, $options: "i" } },
                { location: { $regex: safeSearch, $options: "i" } },
                { source: { $regex: safeSearch, $options: "i" } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortOptions = {};
        sortOptions[sortBy] = order === "desc" ? -1 : 1;

        const total = await Candidate.countDocuments(query);
        const candidates = await Candidate.find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit))
            .populate("feedbacks.interviewer", "name");

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
        const { 
            name, email, phone, role, 
            candidateType, totalExperience, relevantExperience,
            noticePeriod, currentCTC, expectedCTC, location,
            source = "Direct",
            status, stage, ...rest 
        } = req.body;

        // Check if candidate already exists
        const existingCandidate = await Candidate.findOne({ email });
        if (existingCandidate) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: "Candidate with this email already exists" });
        }

        // Collect remaining fields into details
        const details = {};
        const coreFields = [
            "name", "email", "phone", "role", "candidateType", 
            "totalExperience", "relevantExperience", "noticePeriod", 
            "currentCTC", "expectedCTC", "location", "source", 
            "status", "stage", "resumeLink", "details"
        ];

        Object.keys(rest).forEach(key => {
            if (!coreFields.includes(key)) {
                details[key] = rest[key];
            }
        });

        // If an explicit details object was passed, merge it
        if (req.body.details && typeof req.body.details === "object") {
            Object.assign(details, req.body.details);
        }

        const candidate = new Candidate({
            name,
            email,
            phone: phone || "",
            role: role || "Other",
            candidateType: candidateType || "Other",
            totalExperience: totalExperience || "",
            relevantExperience: relevantExperience || "",
            noticePeriod: noticePeriod || "",
            currentCTC: currentCTC || "",
            expectedCTC: expectedCTC || "",
            location: location || "",
            source: source || "Direct",
            submissionDate: new Date().toISOString(),
            resumeLink: req.file ? req.file.path : (req.body.resumeLink || ""),
            details,
            status: status || stage || "New",
            statusHistory: [{
                status: status || stage || "New",
                changedAt: new Date(),
                changedBy: req.user._id
            }]
        });

        await candidate.save();

        // Log Activity
        await Activity.create({
            content: `New candidate added: ${name}`,
            type: "new_candidate",
            candidate: candidate._id,
            user: req.user.id
        });

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

            // Log Activity
            await Activity.create({
                content: `${candidate.name} moved to ${status} round`,
                type: status === "Joined" ? "hired" : status === "Rejected" ? "rejected" : "status_change",
                candidate: candidate._id,
                user: req.user.id
            });
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

// @desc    Add a tag to a candidate
// @route   POST /api/candidates/:id/tags
// @access  Private
export const addCandidateTag = async (req, res) => {
    try {
        const { tag } = req.body;
        if (!tag) return res.status(400).json({ message: "Tag is required" });

        const candidate = await Candidate.findByIdAndUpdate(
            req.params.id,
            { $addToSet: { tags: tag } },
            { new: true }
        );

        if (!candidate) return res.status(404).json({ message: "Candidate not found" });
        res.json(candidate);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Remove a tag from a candidate
// @route   DELETE /api/candidates/:id/tags
// @access  Private
export const removeCandidateTag = async (req, res) => {
    try {
        const { tag } = req.body;
        if (!tag) return res.status(400).json({ message: "Tag is required" });

        const candidate = await Candidate.findByIdAndUpdate(
            req.params.id,
            { $pull: { tags: tag } },
            { new: true }
        );

        if (!candidate) return res.status(404).json({ message: "Candidate not found" });
        res.json(candidate);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Save stage-specific feedback
// @route   POST /api/candidates/:id/feedback
// @access  Private
export const saveCandidateFeedback = async (req, res) => {
    try {
        const { stage, rating, comments } = req.body;
        if (!stage || !comments) {
            return res.status(400).json({ message: "Stage and comments are required" });
        }

        const candidate = await Candidate.findById(req.params.id);
        if (!candidate) return res.status(404).json({ message: "Candidate not found" });

        // Update existing feedback for this stage or push new one
        const feedbackIndex = candidate.feedbacks.findIndex(f => f.stage === stage);
        const feedbackData = {
            stage,
            rating: Number(rating),
            comments,
            interviewer: req.user._id,
            createdAt: new Date()
        };

        if (feedbackIndex > -1) {
            candidate.feedbacks[feedbackIndex] = feedbackData;
        } else {
            candidate.feedbacks.push(feedbackData);
        }

        await candidate.save();
        res.json(candidate);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Update candidate generic
// @route   PUT /api/candidates/:id
// @access  Private
export const updateCandidate = async (req, res) => {
    try {
        const oldCandidate = await Candidate.findById(req.params.id);
        if (!oldCandidate) {
            return res.status(404).json({ message: "Candidate not found" });
        }

        const candidate = await Candidate.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );

        // Log Activity if status changed
        if (req.body.status && req.body.status !== oldCandidate.status) {
            await Activity.create({
                content: `${candidate.name} moved to ${req.body.status} round`,
                type: req.body.status === "Joined" ? "hired" : req.body.status === "Rejected" ? "rejected" : "status_change",
                candidate: candidate._id,
                user: req.user.id
            });

            // Update status history
            candidate.statusHistory.push({
                status: req.body.status,
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
