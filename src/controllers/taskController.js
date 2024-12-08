const Task = require('../models/Task');
const User = require('../models/User');

exports.getAllTasks = async (req, res) => {
    try {
        // First, get the user with their co-taskers
        const user = await User.findById(req.userId).select('coTaskers');
        
        // Get tasks where:
        // 1. User created the task
        // 2. User is assigned to the task
        // 3. Task is created by one of user's co-taskers AND user is assigned to it
        const tasks = await Task.find({
            $or: [
                { createdBy: req.userId },
                { assignedTo: req.userId },
                { 
                    $and: [
                        { createdBy: { $in: user.coTaskers || [] } },
                        { assignedTo: req.userId }
                    ]
                }
            ]
        })
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email')
        .sort('-createdAt');
        
        console.log('User ID:', req.userId);
        console.log('User co-taskers:', user.coTaskers);
        console.log('Found tasks:', tasks);
        
        res.json(tasks);
    } catch (error) {
        console.error('Error in getAllTasks:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.createTask = async (req, res) => {
    try {
        const { title, description, priority, assignedTo, dueDate } = req.body;
        
        // Create initial user statuses for all assigned users
        const userStatuses = assignedTo.map(userId => ({
            user: userId,
            status: 'pending'
        }));

        const task = new Task({
            title,
            description,
            priority,
            dueDate: dueDate ? new Date(dueDate) : null,
            createdBy: req.userId,
            assignedTo,
            userStatuses
        });

        const newTask = await task.save();
        const populatedTask = await Task.findById(newTask._id)
            .populate('assignedTo', 'name email')
            .populate('createdBy', 'name email')
            .populate('userStatuses.user', 'name email');

        res.status(201).json(populatedTask);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateTask = async (req, res) => {
    try {
        const task = await Task.findOneAndUpdate(
            { _id: req.params.id, createdBy: req.userId },
            req.body,
            { new: true }
        )
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name email');

        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        res.json(task);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteTask = async (req, res) => {
    try {
        const task = await Task.findOneAndDelete({
            _id: req.params.id,
            createdBy: req.userId
        });

        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateTaskStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const task = await Task.findById(req.params.id);

        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Initialize userStatuses if it doesn't exist
        if (!task.userStatuses) {
            task.userStatuses = [];
        }

        // Find the user's status entry
        const statusIndex = task.userStatuses.findIndex(
            s => s.user.toString() === req.userId.toString()
        );

        if (statusIndex > -1) {
            task.userStatuses[statusIndex].status = status;
        } else {
            task.userStatuses.push({
                user: req.userId,
                status: status
            });
        }

        await task.save();

        const updatedTask = await Task.findById(task._id)
            .populate('assignedTo', 'name email')
            .populate('createdBy', 'name email')
            .populate('userStatuses.user', 'name email');

        res.json(updatedTask);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};