import { Schema, model, Document, Types } from 'mongoose';

export interface INotification extends Document {
  user: Types.ObjectId; // Usuario al que se le notifica
  message: string;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true, trim: true },
  read: { type: Boolean, default: false }
}, {
  timestamps: true,
});

export default model<INotification>('Notification', notificationSchema);
