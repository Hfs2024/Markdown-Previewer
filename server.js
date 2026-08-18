require("dotenv").config({
    quiet: true
})
const express = require("express");
const rateLimit = require("express-rate-limit");
const path = require("path");
const { MongoStore } = require("connect-mongo");
const mongoose = require("mongoose");
const session = require("express-session");
const schemas = require("./schemas.js");
const bcrypt = require("bcrypt");
const { checkAuth, checkValidID, handleLinkView } = require("./helpers.js");
const actionsRouter = require("./actions.js").router;
const app = express();
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5000,
    message: { error: "Too many requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false
});

// Connect MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected!"))
    .catch(e => console.log(`Failed to connect MongoDB: ${e.message}`));

// Basic setup
const isProduction = process.env.NODE_ENV === "production";
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "10mb" }));
app.use(limiter);
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: process.env.MONGO_URI,
            collectionName: "sessions"
        }),
        cookie: {
            secure: isProduction,
            maxAge: 3600000,
            httpOnly: true,
            sameSite: isProduction ? "none" : "lax"
        }
    })
);
app.use(actionsRouter);

// Main route
app.get("/", function (req, res) {
    return res.sendFile(path.join(__dirname, "public/index.html"));
});

// Users
app.post("/api/v1/signup", async function (req, res) {
    try {
        if (req.session.isLoggedIn) return res.status(400).json({ error: "You are already logged in!" });
        let { username, password } = req.body;
        username = String(username).trim();
        if (typeof password !== "string") return res.status(400).json({ error: "Password must be a type of string!" });
        if (!username || !password) return res.status(400).json({ error: "Invalid payload" });
        if (username.length < 3 || username.length > 10) return res.status(400).json({ error: "Username must be between 3 and 10 chars." });
        if (password.length < 6 || password.length > 12) return res.status(400).json({ error: "Password must be between 6 and 12 chars." });
        const existingUser = await schemas.Users.findOne({ username: username });
        if (existingUser) return res.status(400).json({ error: "Account already exist!" });

        const newUser = new schemas.Users({
            username: username,
            password: await bcrypt.hash(password, 10)
        });

        await newUser.save();

        // Save session
        req.session.isLoggedIn = true;
        req.session.userId = newUser._id;
        req.session.save(err => {
            if (err) {
                console.error("Signup Session Save Failure: ", err.message);
                return res.status(500).json({ error: "Session creation failed" });
            }

            return res.status(200).json({ success: true });
        });
    } catch (e) {
        console.log("Error: " + e.message);
        return res.status(500).json({ error: "Failed to signup. Try again later." });
    }
});

app.post("/api/v1/login", async function (req, res) {
    try {
        const { username, password } = req.body;
        const user = await schemas.Users.findOne({ username: username });
        if (!user) return res.status(400).json({ error: "Invalid username or password!" });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "Inavlid username or password!" });

        // Save session
        req.session.isLoggedIn = true;
        req.session.userId = user._id;
        req.session.save(err => {
            if (err) {
                console.error("Login Session Save Failure: ", err.message);
                return res.status(500).json({ error: "Session creation failed" });
            }

            return res.status(200).json({ success: true });
        });
    } catch (e) {
        console.log("Error: " + e.message);
        return res.status(500).json({ error: "Failed to login. Try again later." });
    }
});

app.post("/api/v1/signout", function (req, res) {
    try {
        req.session.destroy(err => {
            if (err) {
                console.log("Error: " + err.message);
                return res.status(400).json({ error: "Something went wrong." });
            }

            res.clearCookie("connect.sid");
            return res.status(200).json({ success: true });
        });
    } catch (e) {
        console.log("Error: " + e.message);
        return res.status(500).json({ error: "Failed to logout. Try again later." });
    }
});

app.post("/api/v1/get/user-profile", checkAuth, async (req, res) => {
    try {
        const skip = parseInt(req.query.skip) || 0;
        // Find saves
        const saves = await schemas.Saves.find({ by: req.session.userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(10)
            .lean();

        // Extract the IDs
        const ids = saves.map(save => save._id);

        // Send link IF FOUND, that's why we use $in operator and don't join saves and links request together, because some saves may not have links
        const links = await schemas.Links.find({
            for: { $in: ids },
            by: req.session.userId
        })
            .sort({ createdAt: -1 })
            .select("-password")
            .lean();

        return res.status(200).json({
            success: true,
            username: req.currentUser.username,
            savesCount: req.currentUser.savesCount,
            saves, links
        });
    } catch (e) {
        console.log("Error: " + e.message);
        return res.status(500).json({ error: "Failed to get your profile. Try again later." });
    }
});

app.get("/api/v1/get/user-status", checkAuth, function (req, res) {
    try {
        return res.status(200).json({ loggedIn: req.session.isLoggedIn });
    } catch (e) {
        console.log("Error: " + e.message);
        return res.status(500).json({ error: "Server error" });
    }
});

// Saves
app.post("/api/v1/saves", checkAuth, async (req, res) => {
    const session = await mongoose.startSession();

    try {
        let { content, title } = req.body;
        content = String(content).trim();
        title = String(title).trim();
        if (!content || !title) return res.status(400).json({ error: "Invalid payload" });
        if (content.length > 10000) res.status(400).json({ error: "Content cannot exceed 10,000 chars!" });
        if (title.length > 10) return res.status(400).json({ error: "Title cannot exceed 10 chars!" });
        await session.withTransaction(async () => {
            // Insert save
            const newSave = new schemas.Saves({
                content: content,
                title: title,
                by: req.session.userId
            });

            await newSave.save({ session });

            // Update user
            const result = await schemas.Users.updateOne({
                _id: req.session.userId,
                savesCount: { $lt: 50 }
            }, {
                $inc: {
                    savesCount: 1
                }
            }, { session });

            if (result.matchedCount === 0) throw new Error("USER_UPDATE_FAILED");
        });

        return res.status(200).json({ success: true });
    } catch (e) {
        if (txError.message === "USER_UPDATE_FAILED") return res.status(400).json({ error: "You have reached your limit of 50 saves. Delete some old saves to make more space." });
        console.log("Error: " + e.message);
        return res.status(500).json({ error: "Server error" });
    } finally {
        await session.endSession();
    }
});

// Links
app.get("/api/v1/get/save-from-link/:id", checkValidID, async (req, res) => {
    try {
        const id = req.params.id;
        const link = await schemas.Links.findOneAndUpdate(
            {
                for: id,
                burned: false,
                $or: [
                    { status: "public" },
                    { status: "private", by: req.session.userId }
                ]
            },
            [
                {
                    $set: {
                        burned: {
                            $cond: {
                                if: { $eq: ["$burnAfterRead", true] },
                                then: true,
                                else: "$burned"
                            }
                        }
                    }
                }
            ],
            { new: true, updatePipeline: true }
        )
            .populate("for")
            .lean();

        if (!link) return res.status(400).json({ error: "Invalid link!" });
        handleLinkView(link._id.toString());

        return res.status(200).json({
            success: true,
            content: link.for.content
        });
    } catch (e) {
        console.log("Error: " + e.message);
        return res.status(500).json({ error: "Server error" });
    }
});

app.use((req, res, next) => {
    return res.send("<h1>404 - Page not found!</h1>");
});

app.listen(3000, "0.0.0.0", () => {
    console.log("Live on 3000");
});