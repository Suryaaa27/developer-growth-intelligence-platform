import mongoose from 'mongoose';

/**
 * RoleRequirement Schema Placeholder
 * Target job role benchmarks (e.g., Java Backend Developer)
 */
const roleRequirementSchema = new mongoose.Schema(
  {
    roleName: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    requiredSkills: [
      {
        skillName: { type: String, required: true },
        importance: { type: String, enum: ['must-have', 'good-to-have'], default: 'must-have' },
        minimumProficiency: { type: Number, default: 70 }
      }
    ]
  },
  { timestamps: true }
);

export default mongoose.models.RoleRequirement || mongoose.model('RoleRequirement', roleRequirementSchema);
