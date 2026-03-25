import EmailTemplate from "../../models/emailTemplates/emailTemplate.model.js";

// @desc    Get all email templates
// @route   GET /api/email-templates
// @access  Private
export const getAllTemplates = async (req, res) => {
    try {
        const templates = await EmailTemplate.find();
        res.json(templates);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Get a single email template by type
// @route   GET /api/email-templates/:type
// @access  Private
export const getTemplateByType = async (req, res) => {
    try {
        const { type } = req.params;
        const template = await EmailTemplate.findOne({ type: type.toLowerCase() });

        if (!template) {
            return res.status(404).json({ message: `Template of type '${type}' not found` });
        }

        res.json(template);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Update an email template by type
// @route   PUT /api/email-templates/:type
// @access  Private (Superadmin)
export const updateTemplate = async (req, res) => {
    try {
        const { type } = req.params;
        const { subject, body, placeholders } = req.body;

        const template = await EmailTemplate.findOneAndUpdate(
            { type: type.toLowerCase() },
            { $set: { subject, body, ...(placeholders ? { placeholders } : {}) } },
            { new: true, runValidators: true }
        );

        if (!template) {
            return res.status(404).json({ message: `Template of type '${type}' not found` });
        }

        res.json(template);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
