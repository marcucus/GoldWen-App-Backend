import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../../database/entities/user.entity';
import { Profile } from '../../database/entities/profile.entity';
import { UserStatus } from '../../common/enums';
import { UpdateUserDto, UpdateUserSettingsDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['profile', 'profile.photos', 'profile.promptAnswers'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
      relations: ['profile'],
    });
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    // Update user fields
    Object.assign(user, updateUserDto);
    await this.userRepository.save(user);

    // Update profile fields if they exist
    if (user.profile && (updateUserDto.firstName || updateUserDto.lastName)) {
      if (updateUserDto.firstName) {
        user.profile.firstName = updateUserDto.firstName;
      }
      if (updateUserDto.lastName) {
        user.profile.lastName = updateUserDto.lastName;
      }
      await this.profileRepository.save(user.profile);
    }

    return this.findById(id);
  }

  async updateSettings(
    id: string,
    settingsDto: UpdateUserSettingsDto,
  ): Promise<User> {
    const user = await this.findById(id);

    if (settingsDto.notificationsEnabled !== undefined) {
      user.notificationsEnabled = settingsDto.notificationsEnabled;
    }

    await this.userRepository.save(user);
    return this.findById(id);
  }

  async deactivateUser(id: string): Promise<void> {
    const user = await this.findById(id);
    user.status = UserStatus.INACTIVE;
    await this.userRepository.save(user);
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.findById(id);
    user.status = UserStatus.DELETED;
    await this.userRepository.save(user);
  }

  async getUserStats(id: string): Promise<any> {
    const user = await this.findById(id);

    // TODO: Add queries to get user statistics
    return {
      userId: user.id,
      memberSince: user.createdAt,
      isProfileCompleted: user.isProfileCompleted,
      isOnboardingCompleted: user.isOnboardingCompleted,
      // Add more stats as needed
    };
  }
}
