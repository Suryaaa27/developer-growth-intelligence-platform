import mongoose from 'mongoose';

/**
 * AnalysisSnapshot Schema Placeholder
 * Historical snapshots of developer role readiness and identified gaps
 */
const analysisSnapshotSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetRole: { type: String, required: true },
    readinessScore: { type: Number, default: 0 },
    matchedSkills: [{ type: String }],
    missingSkills: [{ type: String }],
    analysisSummary: { type: String, default: '' }
  },
  { timestamps: true }
);

export default mongoose.models.AnalysisSnapshot || mongoose.model('AnalysisSnapshot', analysisSnapshotSchema);
