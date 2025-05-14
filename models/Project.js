const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ProjectStatusEnum = ["Active", "Completed", "Archived"];

const ProjectSchema = new Schema({
  projectName: {
    type: String,
    required: true,
    minlength: [3, "Le nom du projet doit contenir au moins 3 caractères"],
    maxlength: [100, "Le nom du projet ne peut pas dépasser 100 caractères"],
  },
  description: {
    type: String,
    required: true,
    minlength: [10, "La description doit contenir au moins 10 caractères"],
  },
  status: { type: String, enum: ProjectStatusEnum, default: "Active" },
  startDate: {
    type: Date,
    required: true,
    validate: {
      validator: function (v) {
        return v <= this.endDate;
      },
      message: "La date de début doit être antérieure à la date de fin",
    },
  },
  endDate: {
    type: Date,
    required: true,
    validate: {
      validator: function (v) {
        return v >= this.startDate;
      },
      message: "La date de fin doit être postérieure à la date de début",
    },
  },
  tasks: [{ type: Schema.Types.ObjectId, ref: "Task" }],
  members: [{ type: Schema.Types.ObjectId, ref: "User" }],
  owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
  comments: [{ type: Schema.Types.ObjectId, ref: "Comment" }],
  googleCalendarEventId: {
    type: String,
    default: null,
  },
});

module.exports = mongoose.model("Project", ProjectSchema);
