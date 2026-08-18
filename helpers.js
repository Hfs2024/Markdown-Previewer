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
            const tx = redis.multi();
            tx.hGetAll('pending_link_views');
            tx.del('pending_link_views');
            const [viewsData, delResult] = await tx.exec();

            if (!viewsData || Object.keys(viewsData).length === 0) return;
            const operations = Object.keys(viewsData).map(key => {
                return {
                    updateOne: {
                        filter: { _id: new mongoose.Types.ObjectId(key) },
                        update: {
                            $inc: {
                                views: viewsData[key]
                            }
                        }
                    }
                }
            });
            await schemas.Links.bulkWrite(operations, { ordered: false });
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