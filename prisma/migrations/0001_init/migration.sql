CREATE TABLE `Tenant` (
  `id` VARCHAR(191) NOT NULL, `slug` VARCHAR(191) NOT NULL, `name` VARCHAR(191) NOT NULL, `email` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NULL, `timezone` VARCHAR(191) NOT NULL DEFAULT 'Europe/Zagreb', `currency` VARCHAR(191) NOT NULL DEFAULT 'EUR',
  `status` ENUM('TRIAL','ACTIVE','PAST_DUE','SUSPENDED','CANCELLED') NOT NULL DEFAULT 'TRIAL', `cancellationHours` INTEGER NOT NULL DEFAULT 12,
  `slotStepMinutes` INTEGER NOT NULL DEFAULT 15, `defaultReminderHours` JSON NULL, `allowOnlineBooking` BOOLEAN NOT NULL DEFAULT true,
  `requireDeposit` BOOLEAN NOT NULL DEFAULT false, `depositPercent` INTEGER NOT NULL DEFAULT 0, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL, PRIMARY KEY (`id`), UNIQUE INDEX `Tenant_slug_key`(`slug`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `User` (
  `id` VARCHAR(191) NOT NULL, `tenantId` VARCHAR(191) NULL, `email` VARCHAR(191) NOT NULL, `passwordHash` VARCHAR(191) NOT NULL, `name` VARCHAR(191) NOT NULL,
  `role` ENUM('SUPERADMIN','OWNER','MANAGER','STAFF') NOT NULL, `active` BOOLEAN NOT NULL DEFAULT true, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL, PRIMARY KEY (`id`), UNIQUE INDEX `User_email_key`(`email`), INDEX `User_tenantId_role_idx`(`tenantId`,`role`),
  CONSTRAINT `User_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StaffProfile` (
  `id` VARCHAR(191) NOT NULL, `tenantId` VARCHAR(191) NOT NULL, `userId` VARCHAR(191) NOT NULL, `displayName` VARCHAR(191) NOT NULL,
  `color` VARCHAR(191) NULL DEFAULT '#6057ff', `bio` TEXT NULL, `bookable` BOOLEAN NOT NULL DEFAULT true, `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE INDEX `StaffProfile_userId_key`(`userId`), INDEX `StaffProfile_tenantId_bookable_idx`(`tenantId`,`bookable`),
  CONSTRAINT `StaffProfile_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `StaffProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ServiceCategory` (
  `id` VARCHAR(191) NOT NULL, `tenantId` VARCHAR(191) NOT NULL, `name` VARCHAR(191) NOT NULL, `sortOrder` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), INDEX `ServiceCategory_tenantId_sortOrder_idx`(`tenantId`,`sortOrder`),
  CONSTRAINT `ServiceCategory_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Service` (
  `id` VARCHAR(191) NOT NULL, `tenantId` VARCHAR(191) NOT NULL, `categoryId` VARCHAR(191) NULL, `name` VARCHAR(191) NOT NULL, `description` TEXT NULL,
  `durationMin` INTEGER NOT NULL, `prepMin` INTEGER NOT NULL DEFAULT 0, `cleanupMin` INTEGER NOT NULL DEFAULT 0, `priceCents` INTEGER NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true, `onlineBookable` BOOLEAN NOT NULL DEFAULT true, `sortOrder` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), INDEX `Service_tenantId_active_onlineBookable_idx`(`tenantId`,`active`,`onlineBookable`), INDEX `Service_categoryId_idx`(`categoryId`),
  CONSTRAINT `Service_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Service_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ServiceCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StaffService` (
  `staffId` VARCHAR(191) NOT NULL, `serviceId` VARCHAR(191) NOT NULL, `customPriceCents` INTEGER NULL, `customDurationMin` INTEGER NULL,
  PRIMARY KEY (`staffId`,`serviceId`), INDEX `StaffService_serviceId_idx`(`serviceId`),
  CONSTRAINT `StaffService_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `StaffProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `StaffService_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `Service`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WorkingHour` (
  `id` VARCHAR(191) NOT NULL, `tenantId` VARCHAR(191) NOT NULL, `staffId` VARCHAR(191) NULL, `weekday` INTEGER NOT NULL, `startMin` INTEGER NOT NULL,
  `endMin` INTEGER NOT NULL, `active` BOOLEAN NOT NULL DEFAULT true, PRIMARY KEY (`id`), INDEX `WorkingHour_tenantId_staffId_weekday_idx`(`tenantId`,`staffId`,`weekday`),
  CONSTRAINT `WorkingHour_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `WorkingHour_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `StaffProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StaffBreak` (
  `id` VARCHAR(191) NOT NULL, `staffId` VARCHAR(191) NOT NULL, `weekday` INTEGER NOT NULL, `startMin` INTEGER NOT NULL, `endMin` INTEGER NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true, PRIMARY KEY (`id`), INDEX `StaffBreak_staffId_weekday_idx`(`staffId`,`weekday`),
  CONSTRAINT `StaffBreak_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `StaffProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ScheduleOverride` (
  `id` VARCHAR(191) NOT NULL, `tenantId` VARCHAR(191) NOT NULL, `staffId` VARCHAR(191) NULL, `startsAt` DATETIME(3) NOT NULL, `endsAt` DATETIME(3) NOT NULL,
  `type` ENUM('WORKING','BLOCKED') NOT NULL, `note` VARCHAR(191) NULL, PRIMARY KEY (`id`), INDEX `ScheduleOverride_tenantId_staffId_startsAt_endsAt_idx`(`tenantId`,`staffId`,`startsAt`,`endsAt`),
  CONSTRAINT `ScheduleOverride_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ScheduleOverride_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `StaffProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Customer` (
  `id` VARCHAR(191) NOT NULL, `tenantId` VARCHAR(191) NOT NULL, `name` VARCHAR(191) NOT NULL, `email` VARCHAR(191) NULL, `phone` VARCHAR(191) NOT NULL,
  `notes` TEXT NULL, `blocked` BOOLEAN NOT NULL DEFAULT false, `noShowCount` INTEGER NOT NULL DEFAULT 0, `visitCount` INTEGER NOT NULL DEFAULT 0,
  `totalSpentCents` INTEGER NOT NULL DEFAULT 0, `lastVisitAt` DATETIME(3) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE INDEX `Customer_tenantId_phone_key`(`tenantId`,`phone`), INDEX `Customer_tenantId_email_idx`(`tenantId`,`email`),
  CONSTRAINT `Customer_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Appointment` (
  `id` VARCHAR(191) NOT NULL, `tenantId` VARCHAR(191) NOT NULL, `serviceId` VARCHAR(191) NOT NULL, `staffId` VARCHAR(191) NOT NULL, `customerId` VARCHAR(191) NOT NULL,
  `status` ENUM('PENDING','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW') NOT NULL DEFAULT 'CONFIRMED', `source` VARCHAR(191) NOT NULL DEFAULT 'ONLINE',
  `startsAt` DATETIME(3) NOT NULL, `endsAt` DATETIME(3) NOT NULL, `lockStartsAt` DATETIME(3) NOT NULL, `lockEndsAt` DATETIME(3) NOT NULL,
  `priceCents` INTEGER NOT NULL, `depositCents` INTEGER NOT NULL DEFAULT 0, `notes` TEXT NULL, `manageTokenHash` VARCHAR(128) NULL,
  `cancelledAt` DATETIME(3) NULL, `cancelReason` VARCHAR(191) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), INDEX `Appointment_tenantId_startsAt_status_idx`(`tenantId`,`startsAt`,`status`), INDEX `Appointment_staffId_startsAt_endsAt_idx`(`staffId`,`startsAt`,`endsAt`), INDEX `Appointment_customerId_startsAt_idx`(`customerId`,`startsAt`),
  CONSTRAINT `Appointment_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Appointment_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `Service`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Appointment_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `StaffProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Appointment_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AppointmentSlotLock` (
  `id` VARCHAR(191) NOT NULL, `tenantId` VARCHAR(191) NOT NULL, `staffId` VARCHAR(191) NOT NULL, `appointmentId` VARCHAR(191) NOT NULL, `startsAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE INDEX `AppointmentSlotLock_staffId_startsAt_key`(`staffId`,`startsAt`), INDEX `AppointmentSlotLock_tenantId_startsAt_idx`(`tenantId`,`startsAt`), INDEX `AppointmentSlotLock_appointmentId_idx`(`appointmentId`),
  CONSTRAINT `AppointmentSlotLock_staffId_fkey` FOREIGN KEY (`staffId`) REFERENCES `StaffProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `AppointmentSlotLock_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `Appointment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Payment` (
  `id` VARCHAR(191) NOT NULL, `appointmentId` VARCHAR(191) NOT NULL, `provider` VARCHAR(191) NOT NULL DEFAULT 'STRIPE', `providerRef` VARCHAR(191) NULL,
  `amountCents` INTEGER NOT NULL, `status` ENUM('REQUIRES_PAYMENT','PAID','REFUNDED','FAILED','CANCELLED') NOT NULL DEFAULT 'REQUIRES_PAYMENT',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL, PRIMARY KEY (`id`), UNIQUE INDEX `Payment_providerRef_key`(`providerRef`), INDEX `Payment_appointmentId_status_idx`(`appointmentId`,`status`),
  CONSTRAINT `Payment_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `Appointment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PushSubscription` (
  `id` VARCHAR(191) NOT NULL, `tenantId` VARCHAR(191) NOT NULL, `userId` VARCHAR(191) NULL, `endpoint` TEXT NOT NULL, `p256dh` TEXT NOT NULL, `auth` TEXT NOT NULL,
  `userAgent` TEXT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL, PRIMARY KEY (`id`),
  UNIQUE INDEX `PushSubscription_tenantId_endpoint_key`(`tenantId`,`endpoint`(191)), INDEX `PushSubscription_tenantId_userId_idx`(`tenantId`,`userId`),
  CONSTRAINT `PushSubscription_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `NotificationJob` (
  `id` VARCHAR(191) NOT NULL, `tenantId` VARCHAR(191) NOT NULL, `appointmentId` VARCHAR(191) NULL, `channel` ENUM('EMAIL','PUSH','SMS','WHATSAPP') NOT NULL,
  `kind` VARCHAR(191) NOT NULL, `recipient` TEXT NULL, `payload` JSON NOT NULL, `sendAt` DATETIME(3) NOT NULL, `status` ENUM('PENDING','SENT','FAILED','SKIPPED') NOT NULL DEFAULT 'PENDING',
  `attempts` INTEGER NOT NULL DEFAULT 0, `lastError` TEXT NULL, `sentAt` DATETIME(3) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
  INDEX `NotificationJob_status_sendAt_idx`(`status`,`sendAt`), INDEX `NotificationJob_tenantId_appointmentId_idx`(`tenantId`,`appointmentId`),
  CONSTRAINT `NotificationJob_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `NotificationJob_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `Appointment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
