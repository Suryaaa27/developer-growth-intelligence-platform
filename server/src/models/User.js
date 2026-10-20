import mongoose from 'mongoose';

/**
 * User Schema Placeholder
 * Represents application users and their GitHub metadata
 */
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    githubUsername: { type: String, default: '' },
    targetRole: { type: String, default: 'Java Backend Developer' }
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model('User', userSchema);
