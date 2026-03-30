import JobOpening from "../models/jobs/jobOpening.model.js";
import Candidate from "../models/candidates/candidate.model.js";

/**
 * Recalculate and update hired/rejected counts for a specific job role.
 * @param {string} roleName - The name of the role (e.g., "Senior Frontend Developer")
 */
export const updateJobStats = async (roleName) => {
    try {
        console.log(`[DEBUG] updateJobStats called for role: "${roleName}"`);
        if (!roleName) return;

        // 1. Find the job opening for this role
        const jobOpening = await JobOpening.findOne({ role: roleName });
        if (!jobOpening) {
            console.log(`[DEBUG] No JobOpening found for role: "${roleName}"`);
            return;
        }

        // 2. Count candidates by status for this role
        const hiredCount = await Candidate.countDocuments({ 
            role: roleName, 
            status: "Joined" 
        });

        const rejectedCount = await Candidate.countDocuments({ 
            role: roleName, 
            status: "Rejected" 
        });

        const backupCount = await Candidate.countDocuments({
            role: roleName,
            status: "Backup"
        });

        console.log(`[DEBUG] New counts for ${roleName}: Hired=${hiredCount}, Rejected=${rejectedCount}, Backup=${backupCount}`);

        // 3. Update the JobOpening document
        jobOpening.hiredCount = hiredCount;
        jobOpening.rejectedCount = rejectedCount;
        jobOpening.backupCount = backupCount;
        
        await jobOpening.save();

        console.log(`Updated stats for ${roleName}: Hired=${hiredCount}, Rejected=${rejectedCount}`);
    } catch (error) {
        console.error(`Error updating job stats for ${roleName}:`, error.message);
    }
};
