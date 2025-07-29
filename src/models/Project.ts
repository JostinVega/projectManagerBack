import { Schema, model, Document, Types } from 'mongoose';

export interface IProject extends Document {
  name: string;
  description?: string;
  members: Types.ObjectId[]; // Referencias a usuarios
  createdBy: Types.ObjectId; // Usuario que creó el proyecto
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: true,
});

export default model<IProject>('Project', projectSchema);
