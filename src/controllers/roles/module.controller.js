import Module from "../../models/roles/module.model.js";

// @desc    Create new module
// @route   POST /api/modules
// @access  Private (Superadmin only)
export const createModule = async (req, res) => {
    try {
        const { name, slug, description, actions } = req.body;
        const module = await Module.create({ name, slug, description, actions });
        res.status(201).json(module);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Get all modules
// @route   GET /api/modules
// @access  Private (Authenticated)
export const getModules = async (req, res) => {
    try {
        const modules = await Module.find();
        res.json(modules);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Update module
// @route   PATCH /api/modules/:id
export const updateModule = async (req, res) => {
    try {
        const module = await Module.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(module);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// @desc    Delete module
// @route   DELETE /api/modules/:id
export const deleteModule = async (req, res) => {
    try {
        await Module.findByIdAndDelete(req.params.id);
        res.json({ message: "Module deleted" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
