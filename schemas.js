const mongoose = require("mongoose");
const globalDbConnection = mongoose.connection;

// Users
const usersSchema = new mongoose.Schema({
    username: String,
    password: String,
    savesCount: { type: Number, default: 0 }
}); // No email needed

// Saves
const savesSchema = new mongoose.Schema({
    content: String,
    title: String,
    by: mongoose.Schema.Types.ObjectId,
    color: { type: String, enum: ["#f8f9fa", "#c5d9ec", "#83e6b5", "#ee9595"], default: "#f8f9fa" }
});

savesSchema.index({ by: -1 });

// Links
const linksSchema = new mongoose.Schema({
    for: { type: mongoose.Schema.Types.ObjectId, ref: "Saves" },
    by: mongoose.Schema.Types.ObjectId,
    status: { type: String, enum: ["private", "public"], default: "private" },
    password: String,
    expiresAt: Date,
    views: { type: Number, default: 0 }
}, { timestamps: true });

linksSchema.index({ by: 1, for: 1 }, { unique: true });
linksSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = {
    Saves: mongoose.model("Saves", savesSchema, "saves"),
    Users: mongoose.model("Users", usersSchema, "users"),
    Links: mongoose.model("Links", linksSchema, "links")
}