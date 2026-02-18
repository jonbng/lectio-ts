import { z } from "zod";
import { HomeworkSchema, RoomSchema, SubjectSchema, TeacherSchema } from "./common.js";

export const LessonStatusSchema = z.enum(["normal", "changed", "cancelled"]);

export const ScheduleLessonSchema = z.object({
	activityId: z.string().optional(),
	subject: SubjectSchema.optional(),
	teacher: TeacherSchema.optional(),
	room: RoomSchema.optional(),
	startTime: z.string().optional(),
	endTime: z.string().optional(),
	date: z.string(),
	status: LessonStatusSchema,
	title: z.string().optional(),
	topic: z.string().optional(),
	homework: z.array(HomeworkSchema).optional(),
	notes: z.string().optional(),
});

export const ScheduleDaySchema = z.object({
	date: z.string(),
	dayName: z.string(),
	items: z.array(ScheduleLessonSchema),
	isWeekend: z.boolean(),
});

export const ModuleInfoSchema = z.object({
	number: z.number(),
	name: z.string(),
	timeRange: z.string(),
});

export const WeekScheduleSchema = z.object({
	weekNumber: z.number(),
	year: z.number(),
	days: z.array(ScheduleDaySchema),
	modules: z.array(ModuleInfoSchema),
});

export type LessonStatus = z.infer<typeof LessonStatusSchema>;
export type ScheduleLesson = z.infer<typeof ScheduleLessonSchema>;
export type ScheduleDay = z.infer<typeof ScheduleDaySchema>;
export type ModuleInfo = z.infer<typeof ModuleInfoSchema>;
export type WeekSchedule = z.infer<typeof WeekScheduleSchema>;
