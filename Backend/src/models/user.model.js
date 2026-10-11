const mongoose = require("mongoose")


const userSchema = new mongoose.Schema({
    username: {
        type: String,
        unique: [ true, "username already taken" ],
        required: [true, "Username is required"],
        trim:true
    },

    email: {
        type: String,
        unique: [ true, "Account already exists with this email address" ],
        required: true,
        lowercase:true,
        trim:true
    },

    password: {
        type: String,
        required: true,
    }
},{
    timestamps:true
})

const userModel = mongoose.model("users", userSchema)

module.exports = userModel