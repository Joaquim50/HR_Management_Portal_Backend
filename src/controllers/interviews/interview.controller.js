import Interview from "../../models/interviews/interview.model.js";
import Candidate from "../../models/candidates/candidate.model.js";
import Activity from "../../models/dashboard/activity.model.js";
import User from "../../models/users/user.model.js";

// @desc    Schedule a new interview
// @route   POST /api/interviews
// @access  Private
export const scheduleInterview = async (req, res) => {
    try {
        const { candidate, jobOpening, interviewer, scheduledAt, duration, mode, location, type } = req.body;

        const interview = await Interview.create({
            candidate,
            jobOpening,
            interviewer,
            scheduledAt,
            duration,
            mode,
            location,
            type
        });

        // Automatically update candidate interviewer list based on interview
        const interviewerUser = await User.findById(interviewer);
        const interviewerIdentity = interviewerUser?.email || interviewerUser?.name || "";
        
        const updatedCandidate = await Candidate.findByIdAndUpdate(candidate, {
            $addToSet: { interviewer: interviewerIdentity },
            $push: {
                statusHistory: {
                    status: type,
                    changedAt: new Date(),
                    changedBy: req.user._id,
                    notes: `Interview scheduled for ${new Date(scheduledAt).toLocaleString()}`
                }
            }
        }, { new: true });

        // Log Activity
        await Activity.create({
            content: `Interview scheduled for ${updatedCandidate.name} (${type})`,
            type: "interview_scheduled",
            candidate: candidate,
            user: req.user.id
        });

        res.status(201).json(interview);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Get all interviews
// @route   GET /api/interviews
// @access  Private
export const getInterviews = async (req, res) => {
    try {
        const query = {};

        // Security: If not superadmin and no general view permission, enforce interviewer restriction
        const hasGeneralView = req.user.role === "superadmin" || 
                              (req.user.permissions?.pipeline && Object.values(req.user.permissions.pipeline).some(m => m.view));
        
        if (!hasGeneralView) {
            if (!req.user.isInterviewer) {
                return res.status(403).json({ message: "Access denied" });
            }
            // Force restrict to only interviews assigned to this user
            query.interviewer = req.user._id;
        }

        const interviews = await Interview.find(query)
            .populate("candidate", "name email phone role")
            .populate("jobOpening", "role status")
            .populate("interviewer", "name email")
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
            .populate("interviewer", "name email");

        if (!interview) {
            return res.status(404).json({ message: "Interview not found" });
        }

        // Security: Check if user has permission to view this specific interview
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

// @desc    Update interview (e.g., add feedback, reschedule)
// @route   PUT /api/interviews/:id
// @access  Private
export const updateInterview = async (req, res) => {
    try {
        const oldInterview = await Interview.findById(req.params.id);
        if (!oldInterview) {
            return res.status(404).json({ message: "Interview not found" });
        }

        // Security: Check if user has permission to update this specific interview
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

        // Synchronization logic: Update candidate's interviewer list if changed
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

        // Synchronization logic: If feedback or rating is added, update the candidate
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

                    // Remove from active interviewer list (case-insensitive)
                    const identityToPull = feedbackEntry.by.toLowerCase();
                    if (Array.isArray(candidate.interviewer)) {
                        candidate.interviewer = candidate.interviewer.filter(i => i?.toLowerCase() !== identityToPull);
                    } else if (candidate.interviewer?.toLowerCase() === identityToPull) {
                        candidate.interviewer = [];
                    }

                    // Add to technicalHistory or screeningHistory based on interview type
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

                    candidate.statusHistory.push({
                        status: isRejected ? "Rejected" : interview.type || "Technical",
                        changedAt: new Date(),
                        changedBy: req.user?._id || req.user?.id,
                        notes: `Feedback: ${recommendation}`
                    });

                    await candidate.save();

                    // Log Global Activity
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
        res.status(500).json({ error: error.message });
    }
};

// @desc    Delete interview
// @route   DELETE /api/interviews/:id
// @access  Private
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
