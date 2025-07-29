import { Schema, model, Document, Types } from 'mongoose';

export interface ITask extends Document {
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  project: Types.ObjectId; // Proyecto al que pertenece
  assignedTo?: Types.ObjectId; // Usuario asignado
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
  project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  dueDate: { type: Date }
}, {
  timestamps: true,
});

export default model<ITask>('Task', taskSchema);
