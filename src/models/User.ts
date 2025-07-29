// src/models/User.ts

import { User, NotificationSettings } from './user.interface';

export class UserClass implements User {
  userId: string;
  username: string;
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  department?: string;
  bio?: string;
  phone?: string;
  avatar?: string;
  role: 'admin' | 'member' | 'guest';
  createdAt: string;
  updatedAt: string;
  notificationSettings?: NotificationSettings;

  constructor(data: User) {
    this.userId = data.userId;
    this.username = data.username;
    this.email = data.email;
    this.passwordHash = data.passwordHash;
    this.firstName = data.firstName;
    this.lastName = data.lastName;
    this.position = data.position;
    this.department = data.department;
    this.bio = data.bio;
    this.phone = data.phone;
    this.avatar = data.avatar;
    this.role = data.role;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.notificationSettings = data.notificationSettings;
  }
}
