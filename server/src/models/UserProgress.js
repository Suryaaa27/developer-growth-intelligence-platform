import mongoose from 'mongoose';

/**
 * UserProgress Schema Placeholder
 * Tracks a developer's improvement over time across skill areas
 */
const userProgressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    skillName: { type: String, required: true },
    previousScore: { type: Number, default: 0 },
    currentScore: { type: Number, default: 0 },
    progressNotes: { type: String, default: '' }
  },
  { timestamps: true }
);

export default mongoose.models.UserProgress || mongoose.model('UserProgress', userProgressSchema);
