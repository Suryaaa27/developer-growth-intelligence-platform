import mongoose from 'mongoose';

/**
 * Recommendation Schema Placeholder
 * Actionable learning and improvement items suggested to bridge skill gaps
 */
const recommendationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetSkill: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    resourceType: { type: String, enum: ['documentation', 'project_idea', 'practice', 'course'], default: 'project_idea' },
    url: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' }
  },
  { timestamps: true }
);

export default mongoose.models.Recommendation || mongoose.model('Recommendation', recommendationSchema);
