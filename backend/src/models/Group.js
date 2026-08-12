const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
{
    name:{
        type:String,
        required:true,
        trim:true
    },

    description:{
        type:String,
        default:""
    },

    members:[
        {
            type:mongoose.Schema.Types.ObjectId,
            ref:"User"
        }
    ],

    createdBy:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User"
    },

    isActive:{
        type:Boolean,
        default:true
    },

    // --- NEW APPROVAL FIELDS ---
    approvalStatus: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    
    approvedAt: {
        type: Date,
        default: null
    }

},
{
    timestamps:true
});

module.exports=mongoose.model("Group",groupSchema);