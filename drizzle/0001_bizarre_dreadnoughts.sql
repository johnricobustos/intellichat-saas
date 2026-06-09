CREATE TABLE `analytics_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`eventType` enum('message_sent','message_received','escalation','resolution','widget_opened') NOT NULL,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analytics_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`sessionId` varchar(128) NOT NULL,
	`visitorName` varchar(255),
	`visitorEmail` varchar(320),
	`status` enum('active','resolved','escalated') NOT NULL DEFAULT 'active',
	`escalatedAt` timestamp,
	`escalationReason` text,
	`messageCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_chunks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`documentId` int NOT NULL,
	`content` text NOT NULL,
	`embedding` json,
	`chunkIndex` int NOT NULL,
	`tokenCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_chunks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`title` varchar(512) NOT NULL,
	`sourceType` enum('pdf','txt','url','docx') NOT NULL,
	`sourceUrl` text,
	`fileKey` text,
	`status` enum('processing','ready','error') NOT NULL DEFAULT 'processing',
	`chunkCount` int DEFAULT 0,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `escalation_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`ruleType` enum('confidence','keyword','sentiment') NOT NULL,
	`ruleValue` text NOT NULL,
	`action` enum('email','flag','both') NOT NULL DEFAULT 'flag',
	`emailTarget` varchar(320),
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `escalation_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`orgId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`confidence` float,
	`sourceDocs` json,
	`wasEscalated` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `org_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','admin','member') NOT NULL DEFAULT 'member',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `org_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(128) NOT NULL,
	`apiKey` varchar(64) NOT NULL,
	`ownerId` int NOT NULL,
	`plan` enum('starter','pro','enterprise') NOT NULL DEFAULT 'starter',
	`stripeCustomerId` varchar(128),
	`stripeSubscriptionId` varchar(128),
	`botName` varchar(128) DEFAULT 'AI Assistant',
	`botPersonality` text,
	`welcomeMessage` text,
	`botAvatar` text,
	`primaryColor` varchar(7) DEFAULT '#6366f1',
	`monthlyMessageLimit` int DEFAULT 1000,
	`maxDocuments` int DEFAULT 10,
	`messagesUsedThisMonth` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `organizations_apiKey_unique` UNIQUE(`apiKey`)
);
--> statement-breakpoint
CREATE TABLE `qa_pairs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`isActive` boolean DEFAULT true,
	`matchCount` int DEFAULT 0,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `qa_pairs_id` PRIMARY KEY(`id`)
);
