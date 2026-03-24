import Interview from "../../models/interviews/interview.model.js";
import Candidate from "../../models/candidates/candidate.model.js";
import Activity from "../../models/dashboard/activity.model.js";

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

        // Automatically update candidate status based on interview type
        const updatedCandidate = await Candidate.findByIdAndUpdate(candidate, {
            status: type, // Ensure 'type' matches "Screening", "Technical", or "Offer"
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
        const interviews = await Interview.find()
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
            .populate("candidate")
            .populate("jobOpening")
            .populate("interviewer", "name email");

        if (!interview) {
            return res.status(404).json({ message: "Interview not found" });
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
        const interview = await Interview.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!interview) {
            return res.status(404).json({ message: "Interview not found" });
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
