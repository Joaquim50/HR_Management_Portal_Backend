import JobOpening from "../models/jobs/jobOpening.model.js";
import Candidate from "../models/candidates/candidate.model.js";

/**
 * Recalculate and update hired/rejected counts for a specific job role.
 * @param {string} roleName - The name of the role (e.g., "Senior Frontend Developer")
 */
export const updateJobStats = async (roleName) => {
    try {
        if (!roleName) return;

        // 1. Find the job opening for this role
        const jobOpening = await JobOpening.findOne({ role: roleName });
        if (!jobOpening) {
            return;
        }

        // 2. Count candidates by status for this role
        const joinedCount = await Candidate.countDocuments({ 
            role: roleName, 
            status: "Joined" 
        });

        const rejectedCount = await Candidate.countDocuments({ 
            role: roleName, 
            status: "Rejected" 
        });

        const explicitBackupCount = await Candidate.countDocuments({
            role: roleName,
            status: "Backup"
        });

        // 3. New Logic: Cap Hired at Required, push overflow to Backup
        const actualHiredCount = Math.min(joinedCount, jobOpening.requiredCount);
        const overflowBackupCount = Math.max(0, joinedCount - jobOpening.requiredCount);
        const finalBackupCount = explicitBackupCount + overflowBackupCount;


        // 4. Update the JobOpening document
        jobOpening.hiredCount = actualHiredCount;
        jobOpening.rejectedCount = rejectedCount;
        jobOpening.backupCount = finalBackupCount;
        
        await jobOpening.save();

    } catch (error) {
        console.error(`Error updating job stats for ${roleName}:`, error.message);
    }
};
