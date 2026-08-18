const schemas = require("./schemas.js");
const { checkAuth, checkValidID } = require("./helpers.js");
const express = require("express");
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const router = express.Router();

// Delete save
router.delete("/api/v1/delete/save/:id", checkAuth, checkValidID, async (req, res) => {
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

        return res.status(200).json({ success: true });
    } catch (e) {
        if (["USER_UPDATE_FAILED", "SAVE_DELETE_FAILED"].includes(txError.message)) return res.status(400).json({ error: "Something went wrong." });
        console.log("Error: " + e.message);
        return res.status(500).json({ error: "Failed to delete this save. Try again later." });
    } finally {
        await session.endSession();
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

// Update link status
router.put("/api/v1/update-link-status/save/:id", checkAuth, checkValidID, async (req, res) => {
    try {
        const id = req.params.id;
        let { newStatus } = req.body;
        newStatus = newStatus === "public" ? "public" : "private";

        const result = await schemas.Links.updateOne({
            for: id,
            by: req.session.userId
        }, {
            $set: {
                status: newStatus
            }
        });

        if (result.matchedCount === 0) return res.status(400).json({ error: "Link not found!" });
        return res.status(200).json({ success: true });
    } catch (e) {
        console.log("Error: " + e.message);
        return res.status(500).json({ error: "Server Error" });
    }
});

// Create link
router.post("/api/v1/create-link/save/:id", checkAuth, checkValidID, async (req, res) => {
    try {
        const id = req.params.id;
        let { expiresAt, status, burnAfterRead } = req.body;
        status = status === "private" ? "private" : "public";
        const payload = { for: id, by: req.session.userId, status, burnAfterRead: status === "private" ? false : burnAfterRead };

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

// Restore link
router.post("/api/v1/restore-link/save/:id", checkAuth, checkValidID, async (req, res) => {
    try {
        const id = req.params.id;
        const result = await schemas.Links.updateOne({
            for: id,
            by: req.session.userId,
            status: "public",
            burnAfterRead: true,
            burned: true
        }, {
            $set: {
                burned: false
            }
        });

        if (result.matchedCount === 0) return res.status(400).json({ error: "Link not found!" });
        return res.status(200).json({ success: true });
    } catch (e) {
        console.log("Error: " + e.message);
        return res.status(500).json({ error: "Server Error" });
    }
});

module.exports = {
    router
};