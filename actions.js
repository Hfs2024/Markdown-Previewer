const schemas = require("./schemas.js");
const { checkAuth, checkValidID } = require("./helpers.js");
const express = require("express");
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const router = express.Router();

// Delete save
router.delete("/api/v1/delete/save/:id", checkAuth, checkValidID, async (req, res) => {
    try {
        const session = await mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                // Save
                const saveResult = await schemas.Saves.deleteOne({
                    _id: req.params.id,
                    by: req.session.userId
                }, { session });
                if (saveResult.deletedCount === 0) throw new Error("SAVE_DELETE_FAILED");

                // User
                const userResult = await schemas.Users.updateOne({ _id: req.session.userId, savesCount: { $gt: 0 } }, {
                    $inc: { savesCount: -1 }
                }, { session });
                if (userResult.matchedCount === 0) throw new Error("USER_UPDATE_FAILED");

                await schemas.Links.deleteOne({ for: req.params.id }, { session });
            });
        } catch (txError) {
            if (["USER_UPDATE_FAILED", "SAVE_DELETE_FAILED"].includes(txError.message)) return res.status(400).json({ error: "Something went wrong." });
            console.log("Error: " + txError.message);
            return res.status(500).json({ error: "Something went wrong." });
        } finally {
            await session.endSession();
        }

        return res.status(200).json({ success: true });
    } catch (e) {
        console.log("Error: " + e.message);
        return res.status(500).json({ error: "Failed to delete this save. Try again later." });
    }
});

// Update save
router.put("/api/v1/update/save/:id", checkAuth, checkValidID, async (req, res) => {
    try {
        const id = req.params.id;
        const updateObject = {};
        let { content, title, color } = req.body;

        // Fields
        if (content) {
            content = String(content).trim();
            if (content.length > 10000) return res.status(400).json({ error: "Content cannot exceed 10,000 chars!" });
            updateObject.content = content;
        }

        if (title) {
            title = String(title).trim();
            if (title.length > 10) return res.status(400).json({ error: "Title cannot exceed 10 chars!" });
            updateObject.title = title;
        }

        if (color) updateObject.color = color;

        // Update
        const result = await schemas.Saves.updateOne({
            _id: id,
            by: req.session.userId,
        }, {
            $set: updateObject
        }, {
            runValidators: true
        });

        if (result.matchedCount === 0) return res.status(400).json({ error: "Post not found!" });
        return res.status(200).json({ success: true });
    } catch (e) {
        console.log("Error: " + e.message);
        return res.status(500).json({ error: "Failed to update this save. Try again later." });
    }
});

// Delete link
router.delete("/api/v1/delete-link/save/:id", checkAuth, checkValidID, async (req, res) => {
    try {
        const result = await schemas.Links.deleteOne({
            for: req.params.id,
            by: req.session.userId
        });

        if (result.deletedCount === 0) return res.status(400).json({ error: "Link not found!" });
        return res.status(200).json({ success: true });
    } catch (e) {
        console.log("Error: " + e.message);
        return res.status(500).json({ error: "Failed to delete this link. Try again later." });
    }
});

// Create link
router.post("/api/v1/create-link/save/:id", checkAuth, checkValidID, async (req, res) => {
    try {
        const id = req.params.id;
        let { expiresAt, status, password } = req.body;
        if (typeof password !== "string") return res.status(400).json({ error: "Password must be a type of string!" });
        status = status === "public" ? "public" : "private";
        const isPrivate = status === "private";
        const payload = { for: id, by: req.session.userId, status: status };

        if (isPrivate) {
            if (!password) return res.status(400).json({ error: "You didn't enter a password!" });
            if (password.length > 10) return res.status(400).json({ error: "Password cannot exceed 10 chars!" });
            payload.password = await bcrypt.hash(password, 10);
        } else payload.password = "";

        if (expiresAt === '1h') {
            const expirationDate = new Date();
            expirationDate.setHours(expirationDate.getHours() + 1);
            payload.expiresAt = expirationDate;
        }

        const newLink = new schemas.Links(payload);
        await newLink.save();

        return res.status(200).json({ success: true, data: newLink });
    } catch (e) {
        if (e.code === 11000) {
            return res.status(400).json({
                error: "This link already exists and is active."
            });
        }

        console.log("Error: " + e.message);
        return res.status(500).json({ error: "Server Error" });
    }
});

// Update link status
router.put("/api/v1/update-link-status/save/:id", checkAuth, checkValidID, async (req, res) => {
    try {
        const id = req.params.id;
        let { newStatus, newPassword } = req.body;
        newPassword = String(newPassword).trim();
        newStatus = newStatus === "public" ? "public" : "private";
        const isPrivate = newStatus === "private";

        // Is this a valid payload?
        if (isPrivate) {
            if (!newPassword) return res.status(400).json({ error: "You didn't enter a password!" });
            if (newPassword.length > 10) return res.status(400).json({ error: "Password cannot exceed 10 chars!" });
        }

        const result = await schemas.Links.updateOne({
            for: id,
            by: req.session.userId
        }, {
            $set: {
                status: newStatus,
                password: isPrivate ? await bcrypt.hash(newPassword, 10) : ""
            }
        });

        if (result.matchedCount === 0) return res.status(400).json({ error: "Link not found!" });
        return res.status(200).json({ success: true });
    } catch (e) {
        console.log("Error: " + e.message);
        return res.status(500).json({ error: "Server Error" });
    }
});

// Update link password
router.put("/api/v1/update-link-password/save/:id", checkAuth, checkValidID, async (req, res) => {
    try {
        let { newPassword } = req.body;
        if (typeof newPassword !== "string") return res.status(400).json({ error: "Password must be a type of string!" });
        if (!newPassword) return res.status(400).json({ error: "You didn't enter a password!" });
        if (newPassword.length > 10) return res.status(400).json({ error: "Password cannot exceed 10 chars!" });

        const result = await schemas.Links.updateOne({
            for: req.params.id,
            by: req.session.userId,
            status: "private"
        }, {
            $set: {
                password: await bcrypt.hash(newPassword, 10)
            }
        });

        if (result.matchedCount === 0) return res.status(400).json({ error: "Link not found!" });
        return res.status(200).json({ success: true })
    } catch (e) {
        console.log("Error: " + e.message);
        return res.status(400).json({ success: true });
    }
});

// Validate save password
const validatePasswordRateLimiter = rateLimit({
    windowMs: 7 * 60 * 1000,
    max: 10,
    message: { error: "Too many requests, please try later after 7 min." },
    standardHeaders: true,
    legacyHeaders: false
});

router.post("/api/v1/validate-save-password/:id", validatePasswordRateLimiter, checkAuth, checkValidID, async (req, res) => {
    try {
        const id = req.params.id;
        const { password } = req.body;
        if (typeof password !== "string") return res.status(400).json({ error: "Password must be a type of string!" });
        if (!password) return res.status(400).json({ error: "You didn't enter a password!" });

        // Find link
        const link = await schemas.Links.findOne({
            for: id,
            status: "private"
        }).populate("for").lean();

        // Check password match
        const isMatch = await bcrypt.compare(password, link.password);
        if (!isMatch) return res.status(400).json({ error: "Invalid password. Do you want to try again?", invalid_password: true });

        return res.status(200).json({ success: true, content: link.for.content });
    } catch (e) {
        console.log("Error: " + e.message);
        return res.status(400).json({ error: "Server error" });
    }
})

module.exports = {
    router
};