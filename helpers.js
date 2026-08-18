const schemas = require("./schemas.js");
const mongoose = require("mongoose");
const { redis } = require("./setup-redis.js");

// Handle link views
const MAX_SEC = 10;
let flushTimer = null;
async function handleLinkView(linkId) {
    await redis.hIncrBy('pending_link_views', linkId, 1);

    if (!flushTimer) {
        flushTimer = setTimeout(async () => {
            flushTimer = null;
            const snapshotKey = `processing_views:${crypto.randomUUID()}`;
            const moved = await redis.renameNX('pending_link_views', snapshotKey).catch(() => null);
            if (!moved || moved === 0) return; 
            await redis.expire(snapshotKey, 300);
            const viewsData = await redis.hGetAll(snapshotKey);
            if (!viewsData || Object.keys(viewsData).length === 0) return;
            const operations = Object.keys(viewsData).map(key => ({
                updateOne: {
                    filter: { _id: new mongoose.Types.ObjectId(key) },
                    update: { $inc: { views: viewsData[key] } }
                }
            }));

            const bulkWrite = await schemas.Links.bulkWrite(operations, { ordered: false });
            if (bulkWrite.acknowledged) await redis.del(snapshotKey);
        }, MAX_SEC * 1000);
    }
}

// Check auth
async function checkAuth(req, res, next) {
    try {
        if (!req.session.isLoggedIn || !req.session.userId) return res.status(400).json({ error: "You are not logged in!" });
        const foundUser = await schemas.Users.findById(req.session.userId);
        if (!foundUser) return res.status(401).json({ error: "Can't find your account right now!" });

        req.currentUser = foundUser;
        next();
    } catch (e) {
        console.log("Error: " + e.message);
        return res.status(500).json({ error: "Something went wrong!" });
    }
}

// Check valid ID
function checkValidID(req, res, next) {
    const id = req.params.id;
    if (!id || !mongoose.isValidObjectId(id)) return res.status(400).json({ error: "This ID is not valid!" });
    next();
}

module.exports = {
    handleLinkView,
    checkAuth,
    checkValidID
};