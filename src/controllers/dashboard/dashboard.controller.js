import Candidate from "../../models/candidates/candidate.model.js";
import JobOpening from "../../models/jobs/jobOpening.model.js";
import Interview from "../../models/interviews/interview.model.js";
import Activity from "../../models/dashboard/activity.model.js";

export const getDashboardStats = async (req, res) => {
    try {
        // 1. Candidate Stats Cards
        const stats = {
            totalCandidates: await Candidate.countDocuments(),
            screeningPending: await Candidate.countDocuments({ status: "Screening" }),
            technicalPending: await Candidate.countDocuments({ status: "Technical" }),
            offersReleased: await Candidate.countDocuments({ status: "Offer" }),
            joined: await Candidate.countDocuments({ status: "Joined" }),
            rejected: await Candidate.countDocuments({ status: "Rejected" })
        };

        // 2. Role-wise Hiring Progress
        const jobOpenings = await JobOpening.find({ active: true });
        const hiringProgress = jobOpenings.map(job => ({
            role: job.role,
            required: job.requiredCount,
            hired: job.hiredCount,
            backup: job.backupCount, // Added backup count
            progress: job.requiredCount > 0 ? Math.round((job.hiredCount / job.requiredCount) * 100) : 0
        }));

        // 3. Upcoming Interviews (Next 7 Days)
        const upcomingInterviews = await Interview.find({
            scheduledAt: { $gte: new Date() },
            status: "Scheduled"
        })
        .populate("candidate", "name role")
        .sort({ scheduledAt: 1 })
        .limit(5);

        // 4. Recent Activity
        const days = req.query.days === 'all' ? 'all' : parseInt(req.query.days) || 2;
        const activityQuery = {};
        
        if (days !== 'all') {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            activityQuery.createdAt = { $gte: startDate };
        }

        const recentActivity = await Activity.find(activityQuery)
            .populate("user", "name")
            .sort({ createdAt: -1 })
            .limit(50); // Increased limit as it's now filtered by date

        res.json({
            stats,
            hiringProgress,
            upcomingInterviews,
            recentActivity
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
