import JobOpening from "../../models/jobs/jobOpening.model.js";

// @desc    Create a new job opening
// @route   POST /api/jobs
// @access  Private (Admin/Superadmin)
export const createJobOpening = async (req, res) => {
    try {
        const { role, description, requiredCount, category, status } = req.body;

        const existingJob = await JobOpening.findOne({ role });
        if (existingJob) {
            return res.status(400).json({ message: "Job opening for this role already exists" });
        }

        const jobOpening = await JobOpening.create({
            role,
            description,
            requiredCount,
            category,
            status
        });

        res.status(201).json(jobOpening);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Get all job openings
// @route   GET /api/jobs
// @access  Private
export const getJobOpenings = async (req, res) => {
    try {
        const jobs = await JobOpening.find().sort({ createdAt: -1 });
        res.json(jobs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Get single job opening
// @route   GET /api/jobs/:id
// @access  Private
export const getJobOpeningById = async (req, res) => {
    try {
        const job = await JobOpening.findById(req.params.id);
        if (!job) {
            return res.status(404).json({ message: "Job opening not found" });
        }
        res.json(job);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Update job opening
// @route   PUT /api/jobs/:id
// @access  Private (Admin/Superadmin)
export const updateJobOpening = async (req, res) => {
    try {
        const job = await JobOpening.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!job) {
            return res.status(404).json({ message: "Job opening not found" });
        }

        res.json(job);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Delete job opening
// @route   DELETE /api/jobs/:id
// @access  Private (Superadmin)
export const deleteJobOpening = async (req, res) => {
    try {
        const job = await JobOpening.findByIdAndDelete(req.params.id);
        if (!job) {
            return res.status(404).json({ message: "Job opening not found" });
        }
        res.json({ message: "Job opening deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
