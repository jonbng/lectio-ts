import { z } from "zod";

export const TeacherSchema = z.object({
	name: z.string(),
	initials: z.string(),
});

export const RoomSchema = z.object({
	name: z.string(),
});

export const SubjectSchema = z.object({
	name: z.string(),
	code: z.string().optional(),
});

export const HomeworkSchema = z.object({
	description: z.string(),
});

export type Teacher = z.infer<typeof TeacherSchema>;
export type Room = z.infer<typeof RoomSchema>;
export type Subject = z.infer<typeof SubjectSchema>;
export type Homework = z.infer<typeof HomeworkSchema>;
