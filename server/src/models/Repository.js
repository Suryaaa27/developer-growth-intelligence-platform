import mongoose from 'mongoose';

/**
 * Repository Schema Placeholder
 * Stores synced metadata for analyzed GitHub repositories
 */
const repositorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    githubRepoId: { type: String, required: true },
    name: { type: String, required: true },
    fullName: { type: String, required: true },
    description: { type: String, default: '' },
    htmlUrl: { type: String, required: true },
    language: { type: String, default: '' },
    languages: { type: Map, of: Number, default: {} },
    stars: { type: Number, default: 0 },
    forks: { type: Number, default: 0 },
    lastSyncedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export default mongoose.models.Repository || mongoose.model('Repository', repositorySchema);
