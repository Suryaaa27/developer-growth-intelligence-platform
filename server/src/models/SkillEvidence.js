import mongoose from 'mongoose';

/**
 * SkillEvidence Schema Placeholder
 * Represents detected technical skills verified through code artifacts or dependencies
 */
const skillEvidenceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    repositoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Repository' },
    skillName: { type: String, required: true },
    category: { type: String, enum: ['Language', 'Framework', 'Database', 'Tool', 'Architecture'], default: 'Tool' },
    confidenceScore: { type: Number, min: 0, max: 100, default: 0 },
    evidenceType: { type: String, enum: ['dependency', 'file_extension', 'config_file', 'code_pattern'], default: 'dependency' },
    evidenceDetails: { type: String, default: '' }
  },
  { timestamps: true }
);

export default mongoose.models.SkillEvidence || mongoose.model('SkillEvidence', skillEvidenceSchema);
