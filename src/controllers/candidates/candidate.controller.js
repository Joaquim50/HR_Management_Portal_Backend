import xlsx from "xlsx";
import fs from "fs";
import * as sheetService from "../../services/sheet.service.js";
import Candidate from "../../models/candidates/candidate.model.js";
import { updateJobStats } from "../../utils/jobUtils.js";
import Activity from "../../models/dashboard/activity.model.js";
import { sendCandidateEmail } from "../../services/email.service.js";

// @desc    Sync candidates from Google Sheets
// @route   POST /api/candidates/sync
// @access  Private (Superadmin only)
export const syncCandidates = async (req, res) => {
    try {
        const result = await sheetService.syncSheetData(req.user._id);
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


        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        for (const row of data) {
            const email = String(row["Email address"] || row["Email"] || "").trim();
            const name = String(row["Full Name"] || row["Name"] || "").trim();
            const phone = String(row["Phone NO"] || row["Phone Number"] || "").trim();

            if (!email || !name || !phone) continue;

            const roleInput = row["Role"] || row["Position"];

            // Priority: 1. Role from Excel column, 2. Default "Other"
            let role = "Other";
            if (roleInput) {
                const ri = roleInput.toUpperCase();
                if (ri.includes("MERN")) role = "FullStack MERN";
                else if (ri.includes("QA")) role = "QA";
                else if (ri.includes("FLUTTER")) role = "Flutter";
                else if (ri.includes("UI") || ri.includes("UX")) role = "UI/UX";
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
            let resumeLink = "";
            let portfolioLink = "";
            let skills = [];
            let technologies = [];
            let hasLiveExperience = "";
            let mumbaiComfort = "";

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
                else if (k.includes("resume")) resumeLink = v;
                else if (k.includes("portfolio") || k.includes("github")) portfolioLink = v;
                else if (k.includes("skills")) {
                    skills = v ? v.split(",").map(s => s.trim()).filter(Boolean) : [];
                }
                else if (k.includes("technologies")) {
                    technologies = v ? v.split(",").map(s => s.trim()).filter(Boolean) : [];
                }
                else if (k.includes("live") || k.includes("production")) hasLiveExperience = v;
                else if (k.includes("comfort") || k.includes("mumbai") || k.includes("office") || k.includes("saturday") || k.includes("monday")) mumbaiComfort = v;
            });

            const details = {};
            const coreFields = [
                "Email address", "Email", "Full Name", "Name", "Phone NO", "Phone Number",
                "Role", "Position", "Candidate Type", "Type",
                "Total Experience", "Experience", "Work Exp", "Relevant Experience",
                "Notice Period", "Current CTC", "CTC", "Expected CTC", "Expected",
                "Location", "Current City", "Source", "Submission Date", "Timestamp",
                "Portfolio", "Github", "Technologies", "Skills", "Live", "Production", "Comfort", "Mumbai", "Office", "Monday", "Saturday"
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
                resumeLink,
                portfolioLink,
                skills,
                technologies,
                hasLiveExperience,
                mumbaiComfort,
                details,
                submissionDate: row["Submission Date"] || row["Timestamp"] || new Date().toISOString(),
                status: "New",
                statusHistory: [{ status: "New", changedAt: new Date(), changedBy: req.user._id }],
                activityLog: [{
                    date: new Date().toISOString().split("T")[0],
                    action: "Candidate imported from Excel",
                    by: req.user.name || "System"
                }]
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
            limit = 1000,
            search,
            interviewer
        } = req.query;

        const query = {};

        // Interviewer Filter (Matches email/name in active list OR in round history)
        if (interviewer) {
            const escapedInterviewer = interviewer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const interviewerRegex = new RegExp(`^${escapedInterviewer}$`, 'i');
            const interviewerFilter = { 
                $or: [
                    { interviewer: interviewer },
                    { interviewer: interviewerRegex },
                    { "technicalHistory.by": interviewer },
                    { "technicalHistory.by": interviewerRegex },
                    { "screeningHistory.by": interviewer },
                    { "screeningHistory.by": interviewerRegex },
                    { "offerHistory.by": interviewer },
                    { "offerHistory.by": interviewerRegex }
                ] 
            };
            query.$and = query.$and ? [...query.$and, interviewerFilter] : [interviewerFilter];
        }

        // Security: If not superadmin and no general view permission, enforce interviewer restriction
        const hasGeneralView = req.user.role === "superadmin" || 
                              (req.user.permissions?.candidates && Object.values(req.user.permissions.candidates).some(m => m.view));
        
        if (!hasGeneralView) {
            if (!req.user.isInterviewer) {
                return res.status(403).json({ message: "Access denied" });
            }
            // Force restrict to only candidates assigned to this user OR where they gave feedback
            const myEmail = req.user.email;
            const myName = req.user.name;
            const interviewerFilter = { 
                $or: [
                    { interviewer: myEmail }, 
                    { interviewer: myName },
                    { "technicalHistory.by": myEmail },
                    { "technicalHistory.by": myName },
                    { "screeningHistory.by": myEmail },
                    { "screeningHistory.by": myName },
                    { "offerHistory.by": myEmail },
                    { "offerHistory.by": myName }
                ] 
            };
            query.$and = query.$and ? [...query.$and, interviewerFilter] : [interviewerFilter];
        }

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
            .populate("statusHistory.changedBy", "name email");

        if (!candidate) {
            return res.status(404).json({ message: "Candidate not found" });
        }

        // Security: Check if user has permission to view this specific candidate
        const hasGeneralView = req.user.role === "superadmin" || 
                              (req.user.permissions?.candidates && Object.values(req.user.permissions.candidates).some(m => m.view));
        
        if (!hasGeneralView) {
            const isAssigned = candidate.interviewer === req.user.email || candidate.interviewer === req.user.name;
            if (!isAssigned) {
                return res.status(403).json({ message: "Access denied to this candidate" });
            }
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
            portfolioLink, skills, technologies, hasLiveExperience, mumbaiComfort,
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
            "status", "stage", "resumeLink", "details",
            "portfolioLink", "skills", "technologies", "hasLiveExperience", "mumbaiComfort"
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
            portfolioLink: portfolioLink || "",
            skills: (() => {
                if (Array.isArray(skills)) return skills;
                if (!skills) return [];
                try { const p = JSON.parse(skills); return Array.isArray(p) ? p : [p]; } catch { return String(skills).split(",").map(s => s.trim()).filter(Boolean); }
            })(),
            technologies: (() => {
                if (Array.isArray(technologies)) return technologies;
                if (!technologies) return [];
                try { const p = JSON.parse(technologies); return Array.isArray(p) ? p : [p]; } catch { return String(technologies).split(",").map(s => s.trim()).filter(Boolean); }
            })(),
            hasLiveExperience: hasLiveExperience || "",
            mumbaiComfort: mumbaiComfort || "",
            submissionDate: new Date().toISOString(),
            resumeLink: req.file ? req.file.path.replace(/\\/g, "/") : (req.body.resumeLink || req.body.resume || ""),
            details,
            status: status || stage || "New",
            statusHistory: [{
                status: status || stage || "New",
                changedAt: new Date(),
                changedBy: req.user._id
            }],
            activityLog: [{
                date: new Date().toISOString().split("T")[0],
                action: "Candidate created",
                by: req.user.name || "System"
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

            // Add to candidate's own activity log
            candidate.activityLog.push({
                date: new Date().toISOString().split("T")[0],
                action: `Moved to ${status} stage`,
                by: req.user.name || "System"
            });
            await candidate.save();

            // Send automated status email if applicable
            await sendCandidateEmail(candidate, status);
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

        const candidate = await Candidate.findById(req.params.id);
        if (!candidate) return res.status(404).json({ message: "Candidate not found" });

        if (!candidate.tags.includes(tag)) {
            candidate.tags.push(tag);
            candidate.activityLog.push({
                date: new Date().toISOString().split("T")[0],
                action: `Tag "${tag}" added`,
                by: req.user.name || "System"
            });
            await candidate.save();
        }

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

        const candidate = await Candidate.findById(req.params.id);
        if (!candidate) return res.status(404).json({ message: "Candidate not found" });

        candidate.tags = candidate.tags.filter(t => t !== tag);
        candidate.activityLog.push({
            date: new Date().toISOString().split("T")[0],
            action: `Tag "${tag}" removed`,
            by: req.user.name || "System"
        });
        await candidate.save();

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

        // Sync with stage-specific history fields
        const historyEntry = {
            date: new Date().toISOString().split("T")[0],
            notes: comments,
            rating: Number(rating),
            by: req.user.name || "Interviewer"
        };

        if (stage === "Screening") {
            candidate.screeningHistory.push(historyEntry);
        } else if (stage === "Technical") {
            candidate.technicalHistory.push(historyEntry);
        } else if (stage === "Offer") {
            candidate.offerHistory.push(historyEntry);
        }

        // Log to activity log
        candidate.activityLog.push({
            date: new Date().toISOString().split("T")[0],
            action: `${stage} feedback added`,
            by: req.user.name || "Interviewer"
        });

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

        const updateData = { ...req.body };

        // Security: Check if user has permission to update this specific candidate
        const hasGeneralUpdate = req.user.role === "superadmin" || 
                                (req.user.permissions?.candidates && Object.values(req.user.permissions.candidates).some(m => m.update));
        
        if (!hasGeneralUpdate) {
            const userEmail = req.user.email?.toLowerCase();
            const userName = req.user.name?.toLowerCase();
            
            const isAssigned = Array.isArray(oldCandidate.interviewer) 
                ? oldCandidate.interviewer.some(i => i?.toLowerCase() === userEmail || i?.toLowerCase() === userName)
                : (oldCandidate.interviewer?.toLowerCase() === userEmail || oldCandidate.interviewer?.toLowerCase() === userName);
            if (!isAssigned) {
                return res.status(403).json({ message: "Access denied: You can only update candidates assigned to you" });
            }
        }

        if (req.file) {
            updateData.resumeLink = req.file.path.replace(/\\/g, "/");
            if (oldCandidate.resumeLink && oldCandidate.resumeLink.startsWith("uploads")) {
                try {
                    if (fs.existsSync(oldCandidate.resumeLink)) fs.unlinkSync(oldCandidate.resumeLink);
                } catch (err) {
                    console.error("Error deleting old resume:", err.message);
                }
            }
        }

        const oldRole = oldCandidate.role;
        const oldStatus = oldCandidate.status;

        const candidate = await Candidate.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        const statusChanged = req.body.status && req.body.status !== oldStatus;
        const roleChanged = req.body.role && req.body.role !== oldRole;
        const feedbackAdded = (req.body.technicalHistory && req.body.technicalHistory.length > (oldCandidate.technicalHistory?.length || 0)) ||
                            (req.body.screeningHistory && req.body.screeningHistory.length > (oldCandidate.screeningHistory?.length || 0)) ||
                            (req.body.offerHistory && req.body.offerHistory.length > (oldCandidate.offerHistory?.length || 0));

        if (statusChanged || roleChanged || feedbackAdded) {
            // Recalculate stats for old role
            if (oldRole) await updateJobStats(oldRole);
            
            // Recalculate stats for new role (if role changed)
            if (roleChanged && candidate.role && candidate.role !== oldRole) {
                await updateJobStats(candidate.role);
            }

            // Log Activity if status changed or feedback added
            if (statusChanged || feedbackAdded) {
                let activityContent = "";
                let activityType = "status_change";

                if (statusChanged) {
                    activityContent = `${candidate.name} moved to ${req.body.status} round`;
                    activityType = req.body.status === "Joined" ? "hired" : req.body.status === "Rejected" ? "rejected" : "status_change";
                } else if (feedbackAdded) {
                    const type = req.body.technicalHistory ? "Technical" : req.body.screeningHistory ? "Screening" : "Offer";
                    activityContent = `Feedback received for ${candidate.name} (${type} round)`;
                    activityType = "status_change";
                }

                await Activity.create({
                    content: activityContent,
                    type: activityType,
                    candidate: candidate._id,
                    user: req.user?._id || req.user?.id
                });

                // Update status history
                candidate.statusHistory.push({
                    status: req.body.status || oldStatus,
                    changedAt: new Date(),
                    changedBy: req.user?._id || req.user?.id,
                    notes: feedbackAdded ? "Feedback received" : ""
                });

                // Add to candidate's own activity log
                candidate.activityLog.push({
                    date: new Date().toISOString().split("T")[0],
                    action: activityContent,
                    by: req.user?.name || "System"
                });

                // Remove interviewer from active assigned list if feedback was added
                if (feedbackAdded) {
                    const userEmail = req.user.email?.toLowerCase();
                    const userName = req.user.name?.toLowerCase();
                    
                    if (Array.isArray(candidate.interviewer)) {
                        candidate.interviewer = candidate.interviewer.filter(i => 
                            i?.toLowerCase() !== userEmail && i?.toLowerCase() !== userName
                        );
                    } else if (candidate.interviewer?.toLowerCase() === userEmail || candidate.interviewer?.toLowerCase() === userName) {
                        candidate.interviewer = [];
                    }
                }

                await candidate.save();

                // Send automated status email if applicable
                if (statusChanged) {
                    await sendCandidateEmail(candidate, req.body.status);
                }
            }
        }

        res.json(candidate);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Add a skill to a candidate
// @route   POST /api/candidates/:id/skills
// @access  Private
export const addCandidateSkill = async (req, res) => {
    try {
        const { skill } = req.body;
        if (!skill) return res.status(400).json({ message: "Skill is required" });

        const candidate = await Candidate.findById(req.params.id);
        if (!candidate) return res.status(404).json({ message: "Candidate not found" });

        if (!candidate.skills.includes(skill)) {
            candidate.skills.push(skill);
            candidate.activityLog.push({
                date: new Date().toISOString().split("T")[0],
                action: `Skill "${skill}" added`,
                by: req.user.name || "System"
            });
            await candidate.save();
        }

        res.json(candidate);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Remove a skill from a candidate
// @route   DELETE /api/candidates/:id/skills
// @access  Private
export const removeCandidateSkill = async (req, res) => {
    try {
        const { skill } = req.body;
        if (!skill) return res.status(400).json({ message: "Skill is required" });

        const candidate = await Candidate.findById(req.params.id);
        if (!candidate) return res.status(404).json({ message: "Candidate not found" });

        candidate.skills = candidate.skills.filter(s => s !== skill);
        candidate.activityLog.push({
            date: new Date().toISOString().split("T")[0],
            action: `Skill "${skill}" removed`,
            by: req.user.name || "System"
        });
        await candidate.save();

        res.json(candidate);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Add a technology to a candidate
// @route   POST /api/candidates/:id/technologies
// @access  Private
export const addCandidateTechnology = async (req, res) => {
    try {
        const { technology } = req.body;
        if (!technology) return res.status(400).json({ message: "Technology is required" });

        const candidate = await Candidate.findById(req.params.id);
        if (!candidate) return res.status(404).json({ message: "Candidate not found" });

        if (!candidate.technologies.includes(technology)) {
            candidate.technologies.push(technology);
            candidate.activityLog.push({
                date: new Date().toISOString().split("T")[0],
                action: `Technology "${technology}" added`,
                by: req.user.name || "System"
            });
            await candidate.save();
        }

        res.json(candidate);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Remove a technology from a candidate
// @route   DELETE /api/candidates/:id/technologies
// @access  Private
export const removeCandidateTechnology = async (req, res) => {
    try {
        const { technology } = req.body;
        if (!technology) return res.status(400).json({ message: "Technology is required" });

        const candidate = await Candidate.findById(req.params.id);
        if (!candidate) return res.status(404).json({ message: "Candidate not found" });

        candidate.technologies = candidate.technologies.filter(t => t !== technology);
        candidate.activityLog.push({
            date: new Date().toISOString().split("T")[0],
            action: `Technology "${technology}" removed`,
            by: req.user.name || "System"
        });
        await candidate.save();

        res.json(candidate);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Upload candidate resume separately
// @route   POST /api/candidates/:id/resume
// @access  Private
export const uploadCandidateResume = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Please upload a resume file" });
        }

        const candidate = await Candidate.findById(req.params.id);
        if (!candidate) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(404).json({ message: "Candidate not found" });
        }

        // Delete old resume if exists
        if (candidate.resumeLink && candidate.resumeLink.startsWith("uploads")) {
            try {
                if (fs.existsSync(candidate.resumeLink)) fs.unlinkSync(candidate.resumeLink);
            } catch (err) {
                console.error("Error deleting old resume:", err.message);
            }
        }

        candidate.resumeLink = req.file.path.replace(/\\/g, "/");
        candidate.activityLog.push({
            date: new Date().toISOString().split("T")[0],
            action: "Resume updated",
            by: req.user.name || "System"
        });
        await candidate.save();

        res.json({ message: "Resume uploaded successfully", resumeLink: candidate.resumeLink });
    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: error.message });
    }
};

// @desc    Bulk update candidates
// @route   POST /api/candidates/bulk-update
// @access  Private
export const bulkUpdateCandidates = async (req, res) => {
    try {
        const { ids, data } = req.body || {};
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: "Please provide an array of candidate IDs" });
        }

        const statsToUpdate = new Set();
        const results = [];

        for (const id of ids) {
            const candidate = await Candidate.findById(id);
            if (!candidate) continue;

            const oldRole = candidate.role;
            const oldStatus = candidate.status;
            const updates = { ...data };

            // Sync stage with status if provided in frontend-speak
            if (updates.stage && !updates.status) {
                updates.status = updates.stage;
            }

            const statusChanged = updates.status && updates.status !== oldStatus;
            const roleChanged = updates.role && updates.role !== oldRole;

            if (statusChanged || roleChanged) {
                if (oldRole) statsToUpdate.add(oldRole);
                if (updates.role) statsToUpdate.add(updates.role);
            }

            // If status is changing, log history and activity
            if (statusChanged) {
                candidate.statusHistory.push({
                    status: updates.status,
                    changedAt: new Date(),
                    changedBy: req.user._id
                });

                candidate.activityLog.push({
                    date: new Date().toISOString().split("T")[0],
                    action: `Bulk update: Moved to ${updates.status}`,
                    by: req.user.name || "System"
                });
            }

            // Handle tags specially if we want to append (though usually bulk set is easier)
            Object.assign(candidate, updates);

            await candidate.save();
            results.push(candidate._id);
        }

        // Update job stats for all affected roles
        for (const role of statsToUpdate) {
            await updateJobStats(role);
        }

        res.json({ 
            message: `${results.length} candidates updated successfully`, 
            count: results.length,
            updatedIds: results
        });
    } catch (error) {
        console.error("Bulk update error:", error.message);
        res.status(500).json({ error: error.message });
    }
};
