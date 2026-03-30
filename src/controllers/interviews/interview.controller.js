import Interview from "../../models/interviews/interview.model.js";
import Candidate from "../../models/candidates/candidate.model.js";
import Activity from "../../models/dashboard/activity.model.js";
import User from "../../models/users/user.model.js";
import {
    createScheduledInterview,
    rescheduleInterview,
    cancelScheduledInterview,
    completeScheduledInterview
} from "../../services/interviewScheduling.service.js";

// ─── NEW: Schedule interview with calendar integration ─────

// @desc    Schedule a new interview (with calendar provider)
// @route   POST /api/interviews
// @access  Private (Admin/Superadmin)
export const scheduleInterview = async (req, res) => {
    try {
        const { candidateId, interviewerId, roundType, title, date, startTime, endTime, timezone, duration, mode, notes, jobOpeningId } = req.body;

        // Basic validation
        if (!candidateId) return res.status(400).json({ message: "candidateId is required" });
        if (!interviewerId) return res.status(400).json({ message: "interviewerId is required" });
        if (!roundType) return res.status(400).json({ message: "roundType is required" });
        if (!startTime) return res.status(400).json({ message: "startTime is required" });
        if (!endTime) return res.status(400).json({ message: "endTime is required" });

        const interview = await createScheduledInterview(req.body, req.user);
        res.status(201).json(interview);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ message: error.message || "Failed to schedule interview" });
    }
};

// @desc    Reschedule an interview
// @route   PUT /api/interviews/:id
// @access  Private (Admin/Superadmin)
export const updateInterviewSchedule = async (req, res) => {
    try {
        const { startTime, endTime } = req.body;

        // If it's a reschedule (has new times), use the service
        if (startTime && endTime) {
            const interview = await rescheduleInterview(req.params.id, req.body, req.user);
            return res.json(interview);
        }

        // Otherwise, it's a generic update (feedback, rating, etc.) — use legacy logic
        const oldInterview = await Interview.findById(req.params.id);
        if (!oldInterview) {
            return res.status(404).json({ message: "Interview not found" });
        }

        // Security: Check if user has permission to update this interview
        const hasGeneralUpdate = req.user.role === "superadmin" || 
                                (req.user.permissions?.pipeline && Object.values(req.user.permissions.pipeline).some(m => m.update));
        
        if (!hasGeneralUpdate) {
            const isAssigned = oldInterview.interviewer?.toString() === req.user._id?.toString();
            if (!isAssigned) {
                return res.status(403).json({ message: "Access denied: You can only update interviews assigned to you" });
            }
        }

        const interview = await Interview.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        ).populate("candidate").populate("interviewer", "name email");

        if (!interview) {
            return res.status(404).json({ message: "Interview not found" });
        }

        // Sync: Update candidate's interviewer list if changed
        if (req.body.interviewer) {
            const candidateId = interview.candidate?._id || interview.candidate;
            if (candidateId) {
                const interviewerIdentity = interview.interviewer?.email || interview.interviewer?.name || "";
                if (interviewerIdentity) {
                    await Candidate.findByIdAndUpdate(candidateId, {
                        $addToSet: { interviewer: interviewerIdentity }
                    });
                }
            }
        }

        // Sync: If feedback/rating is added, update the candidate
        if (req.body.feedback || req.body.rating || req.body.status === "Completed") {
            const candidateId = interview.candidate?._id || interview.candidate;
            if (candidateId) {
                const candidate = await Candidate.findById(candidateId);
                if (candidate) {
                    const recommendation = req.body.recommendation || "Move Forward";
                    const isRejected = recommendation === "Rejected";
                    
                    const interviewerIdentity = interview.interviewer?.email || interview.interviewer?.name || "";
                    const feedbackEntry = {
                        date: new Date(),
                        notes: req.body.feedback || "Feedback submitted via Interviewer Portal",
                        rating: req.body.rating,
                        recommendation: recommendation,
                        by: interviewerIdentity || req.user.email || req.user.name || "Interviewer"
                    };

                    // Remove from active interviewer list
                    const userEmail = (req.user.email || "").toLowerCase();
                    const userName = (req.user.name || "").toLowerCase();
                    const userIdStr = (req.user._id || req.user.id || "").toString().toLowerCase();
                    
                    if (Array.isArray(candidate.interviewer)) {
                        candidate.interviewer = candidate.interviewer.filter(i => {
                            if (!i) return false;
                            const val = i.toString().toLowerCase();
                            return val !== userEmail && val !== userName && val !== userIdStr;
                        });
                    } else if (candidate.interviewer) {
                        const val = candidate.interviewer.toString().toLowerCase();
                        if (val === userEmail || val === userName || val === userIdStr) {
                            candidate.interviewer = [];
                        }
                    }

                    // Add to stage-specific history
                    if (interview.type === "Technical") {
                        candidate.technicalHistory.push(feedbackEntry);
                    } else if (interview.type === "Screening") {
                        candidate.screeningHistory.push(feedbackEntry);
                    } else if (interview.type === "Offer") {
                        candidate.offerHistory.push(feedbackEntry);
                    } else {
                        candidate.technicalHistory.push(feedbackEntry);
                    }

                    candidate.activityLog.push({
                        date: new Date(),
                        action: `Interview Feedback Submitted: ${recommendation}`,
                        by: feedbackEntry.by
                    });

                    candidate.status = isRejected ? "Rejected" : (interview.type || "Technical");

                    candidate.statusHistory.push({
                        status: isRejected ? "Rejected" : interview.type || "Technical",
                        changedAt: new Date(),
                        changedBy: req.user?._id || req.user?.id,
                        notes: `Feedback: ${recommendation}`
                    });

                    await candidate.save();

                    // Cleanup: Also mark any other scheduled interviews for this SAME candidate and SAME round as completed
                    // to prevent them from staying "stuck" in the Assigned list.
                    await Interview.updateMany(
                        {
                            candidate: candidateId,
                            type: interview.type,
                            status: { $in: ["Scheduled", "Rescheduled"] },
                            _id: { $ne: interview._id }
                        },
                        {
                            status: "Completed",
                            completedAt: new Date(),
                            notes: "Auto-completed via round feedback submission"
                        }
                    );

                    await Activity.create({
                        content: `Feedback submitted for ${interview.candidate?.name || 'Candidate'} (Result: ${recommendation})`,
                        type: isRejected ? "rejected" : "status_change",
                        candidate: candidateId,
                        user: req.user?._id || req.user?.id
                    });
                }
            }
        }

        res.json(interview);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ message: error.message || "Failed to update interview" });
    }
};

// @desc    Cancel an interview
// @route   PATCH /api/interviews/:id/cancel
// @access  Private (Admin/Superadmin)
export const cancelInterview = async (req, res) => {
    try {
        const { cancellationReason } = req.body;
        const interview = await cancelScheduledInterview(req.params.id, cancellationReason, req.user);
        res.json(interview);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ message: error.message || "Failed to cancel interview" });
    }
};

// @desc    Mark interview as completed
// @route   PATCH /api/interviews/:id/complete
// @access  Private (Admin/Superadmin)
export const completeInterview = async (req, res) => {
    try {
        const interview = await completeScheduledInterview(req.params.id, req.user);
        res.json(interview);
    } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ message: error.message || "Failed to complete interview" });
    }
};

// ─── Fetch endpoints ───────────────────────────────────────

// @desc    Get all interviews (admin: all, interviewer: own)
// @route   GET /api/interviews
// @access  Private
export const getInterviews = async (req, res) => {
    try {
        const query = {};

        // Security: If not superadmin and no general view permission, restrict
        const hasGeneralView = req.user.role === "superadmin" || 
                              (req.user.permissions?.pipeline && Object.values(req.user.permissions.pipeline).some(m => m.view));
        
        if (!hasGeneralView) {
            if (!req.user.isInterviewer) {
                return res.status(403).json({ message: "Access denied" });
            }
            query.interviewer = req.user._id;
        }

        // Optional filters
        if (req.query.status) query.status = req.query.status;
        if (req.query.type) query.type = req.query.type;
        if (req.query.candidate) query.candidate = req.query.candidate;
        if (req.query.interviewer && hasGeneralView) query.interviewer = req.query.interviewer;

        const interviews = await Interview.find(query)
            .populate("candidate", "name email phone role resumeLink")
            .populate("jobOpening", "role status")
            .populate("interviewer", "name email")
            .populate("scheduledBy", "name email")
            .sort({ scheduledAt: -1 });

        res.json(interviews);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Get single interview
// @route   GET /api/interviews/:id
// @access  Private
export const getInterviewById = async (req, res) => {
    try {
        const interview = await Interview.findById(req.params.id)
            .populate("candidate", "name email phone role totalExperience noticePeriod status resumeLink")
            .populate("jobOpening")
            .populate("interviewer", "name email")
            .populate("scheduledBy", "name email");

        if (!interview) {
            return res.status(404).json({ message: "Interview not found" });
        }

        // Security check
        const hasGeneralView = req.user.role === "superadmin" || 
                              (req.user.permissions?.pipeline && Object.values(req.user.permissions.pipeline).some(m => m.view));
        
        if (!hasGeneralView) {
            const isAssigned = interview.interviewer?._id?.toString() === req.user._id?.toString() || 
                               interview.interviewer?.toString() === req.user._id?.toString();
            if (!isAssigned) {
                return res.status(403).json({ message: "Access denied to this interview" });
            }
        }

        res.json(interview);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Get interviews for a specific candidate
// @route   GET /api/interviews/candidate/:candidateId
// @access  Private
export const getCandidateInterviews = async (req, res) => {
    try {
        const interviews = await Interview.find({ candidate: req.params.candidateId })
            .populate("interviewer", "name email")
            .populate("scheduledBy", "name email")
            .sort({ scheduledAt: -1 });

        res.json(interviews);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Get interviews for a specific interviewer
// @route   GET /api/interviews/interviewer/:interviewerId
// @access  Private
export const getInterviewerInterviews = async (req, res) => {
    try {
        // Security: only allow seeing own interviews unless admin
        const hasGeneralView = req.user.role === "superadmin" || 
                              (req.user.permissions?.pipeline && Object.values(req.user.permissions.pipeline).some(m => m.view));
        
        if (!hasGeneralView && req.params.interviewerId !== req.user._id.toString()) {
            return res.status(403).json({ message: "Access denied" });
        }

        const interviews = await Interview.find({ interviewer: req.params.interviewerId })
            .populate("candidate", "name email phone role resumeLink")
            .populate("scheduledBy", "name email")
            .sort({ scheduledAt: -1 });

        res.json(interviews);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Delete interview
// @route   DELETE /api/interviews/:id
// @access  Private (Superadmin)
export const deleteInterview = async (req, res) => {
    try {
        const interview = await Interview.findByIdAndDelete(req.params.id);
        if (!interview) {
            return res.status(404).json({ message: "Interview not found" });
        }
        res.json({ message: "Interview deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
